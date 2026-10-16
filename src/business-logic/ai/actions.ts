import { addDaysIso, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import { Roles } from "../../security/index";
import {
  parseCreateBatch,
  parseCreateCategory,
  parseCreateCustomer,
  parseCreatePayment,
  parseCreateProduct,
  parseCreatePurchase,
  parseCreateSale,
  parseCreateScenario,
  parseCreateSupplier,
  parseCreateChatMessage,
  parseUpdateContactMessage,
  parseUpdateCustomer,
  parseUpdateProduct,
  parseUpdateSupplier,
} from "../../models/index";
import { findProductById, listProducts } from "../products/index";
import { findCustomerById, getCustomerBalance } from "../customers/index";
import { findSupplierById } from "../suppliers/index";
import { getSale } from "../sales/index";
import { ALL, clean, int, isoDate, num, obj, page, propose, str, validate, type ToolDef } from "./tool-kit";

const money = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;
const yesNo = (b: unknown) => (b === true ? "sí" : "no");

/** Unidades vendibles hoy (lotes no vencidos) de un producto. */
const sellable = async (productId: number, sku: string): Promise<number> => {
  const r = await listProducts(page(5), { search: sku, active: true });
  return r.items.find((p) => p.id === productId)?.availableStock ?? 0;
};

/**
 * Acciones de Tita: todo lo que el rol puede hacer en la app, preparado como tarjeta para confirmar. No incluye crear
 * usuarios ni cambiar contraseñas: exigirían escribir claves en el chat, que viaja al proveedor de IA.
 */
export const ACTION_TOOLS: Record<string, ToolDef> = {
  /* ------------------------------------------------------------------ clientes */
  crear_cliente: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Nuevo cliente",
    spec: {
      name: "crear_cliente",
      description: "Prepara la creación de un cliente (nombre, documento; teléfono y cupo de crédito opcionales). La persona confirma en el chat.",
      input_schema: obj({ name: { type: "string" }, documentId: { type: "string" }, phone: { type: "string" }, creditLimit: { type: "number", description: "Cupo de crédito en pesos" } }, ["name", "documentId"]),
    },
    run: async (i, ctx) => {
      const body = clean({ name: str(i["name"]), documentId: str(i["documentId"]), phone: str(i["phone"]), creditLimit: num(i["creditLimit"]) });
      const v = validate(parseCreateCustomer, body);
      if (!v.ok) return v.error;
      return propose(ctx, {
        type: "action",
        kind: "create_customer",
        title: "Crear cliente",
        lines: [`${body["name"]} · documento ${body["documentId"]}`, `Teléfono: ${body["phone"] ?? "—"}`, `Cupo de crédito: ${money(Number(body["creditLimit"] ?? 0))}`],
        warnings: [],
        confirmLabel: "Crear cliente",
        request: { method: "POST", path: "/customers", body },
      });
    },
  },
  actualizar_cliente: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Editar cliente",
    spec: {
      name: "actualizar_cliente",
      description: "Prepara cambios a un cliente existente (nombre, documento, teléfono, cupo o activarlo/desactivarlo). Envíe solo los campos que cambian.",
      input_schema: obj({ customerId: { type: "integer" }, name: { type: "string" }, documentId: { type: "string" }, phone: { type: "string" }, creditLimit: { type: "number" }, active: { type: "boolean" } }, ["customerId"]),
    },
    run: async (i, ctx) => {
      const id = int(i["customerId"]);
      const c = id !== undefined ? await findCustomerById(id) : undefined;
      if (!c || id === undefined) return { error: "Cliente no encontrado" };
      const body = clean({ name: str(i["name"]), documentId: str(i["documentId"]), phone: str(i["phone"]), creditLimit: num(i["creditLimit"]), active: typeof i["active"] === "boolean" ? i["active"] : undefined });
      if (Object.keys(body).length === 0) return { error: "No hay cambios" };
      const v = validate(parseUpdateCustomer, body);
      if (!v.ok) return v.error;
      const labels: Record<string, string> = { name: "Nombre", documentId: "Documento", phone: "Teléfono", creditLimit: "Cupo", active: "Activo" };
      return propose(ctx, {
        type: "action",
        kind: "update_customer",
        title: `Editar cliente: ${c.name}`,
        lines: Object.entries(body).map(([k, val]) => `${labels[k] ?? k}: ${k === "creditLimit" ? money(Number(val)) : k === "active" ? yesNo(val) : String(val)}`),
        warnings: body["active"] === false && c.balance > 0 ? [`Tiene saldo de ${money(c.balance)}.`] : [],
        confirmLabel: "Guardar cambios",
        request: { method: "PUT", path: `/customers/${id}`, body },
      });
    },
  },
  registrar_abono: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Abono",
    spec: {
      name: "registrar_abono",
      description: "Prepara un abono de un cliente a su saldo. El monto no puede superar el saldo.",
      input_schema: obj({ customerId: { type: "integer" }, amount: { type: "number" } }, ["customerId", "amount"]),
    },
    run: async (i, ctx) => {
      const id = int(i["customerId"]);
      const amount = num(i["amount"]);
      if (id === undefined || amount === undefined) return { error: "Cliente y monto requeridos" };
      const v = validate(parseCreatePayment, { amount });
      if (!v.ok) return v.error;
      const b = await getCustomerBalance(id);
      if (amount > b.balance) return { error: `El abono supera el saldo (${money(b.balance)})` };
      return propose(ctx, {
        type: "action",
        kind: "payment",
        title: `Abono de ${b.name}`,
        lines: [`Monto: ${money(amount)}`, `Saldo actual: ${money(b.balance)} → queda ${money(b.balance - amount)}`],
        warnings: [],
        confirmLabel: "Registrar abono",
        request: { method: "POST", path: `/customers/${id}/payments`, body: { amount } },
        handoff: { type: "payment", customerId: id, customerName: b.name, amount, balance: b.balance },
      });
    },
  },

  /* ------------------------------------------------------------------ ventas */
  registrar_venta: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Venta",
    spec: {
      name: "registrar_venta",
      description:
        "Prepara una venta (contado o crédito) con productos y cantidades. A crédito exige cliente. El servidor fija precios y descuenta por FEFO al confirmar. Use ids reales de buscar_productos / buscar_clientes.",
      input_schema: obj(
        {
          customerId: { type: "integer" },
          paymentType: { type: "string", enum: ["CASH", "CREDIT"] },
          lines: { type: "array", items: obj({ productId: { type: "integer" }, quantity: { type: "integer", minimum: 1 } }, ["productId", "quantity"]) },
        },
        ["paymentType", "lines"],
      ),
    },
    run: async (i, ctx) => {
      const paymentType = i["paymentType"] === "CREDIT" ? "CREDIT" : "CASH";
      const customerId = int(i["customerId"]);
      const raw = Array.isArray(i["lines"]) ? (i["lines"] as Record<string, unknown>[]) : [];
      const lines = raw.map((l) => ({ productId: int(l["productId"]), quantity: int(l["quantity"]) })).filter((l): l is { productId: number; quantity: number } => l.productId !== undefined && l.quantity !== undefined);
      const body = clean({ customerId, paymentType, lines });
      const v = validate(parseCreateSale, body);
      if (!v.ok) return v.error;
      const warnings: string[] = [];
      const detail: { productId: number; productName: string; quantity: number; unitPrice: number; available: number }[] = [];
      for (const l of lines) {
        const p = await findProductById(l.productId);
        if (!p || !p.active) return { error: `El producto ${l.productId} no existe o está inactivo` };
        const available = await sellable(p.id, p.sku);
        if (l.quantity > available) warnings.push(`${p.name}: se piden ${l.quantity} y hay ${available} vendibles.`);
        detail.push({ productId: p.id, productName: p.name, quantity: l.quantity, unitPrice: p.salePrice, available });
      }
      const total = detail.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      let customerName: string | null = null;
      if (customerId !== undefined) {
        const b = await getCustomerBalance(customerId);
        customerName = b.name;
        if (paymentType === "CREDIT" && total > b.availableCredit) warnings.push(`Supera el crédito disponible (${money(b.availableCredit)}).`);
      }
      return propose(ctx, {
        type: "action",
        kind: "sale",
        title: `Venta ${paymentType === "CREDIT" ? "a crédito" : "de contado"}`,
        lines: [...detail.map((l) => `${l.quantity} × ${l.productName} · ${money(l.quantity * l.unitPrice)}`), `Cliente: ${customerName ?? "Consumidor final"}`, `Total estimado: ${money(total)}`],
        warnings,
        confirmLabel: "Registrar venta",
        request: { method: "POST", path: "/sales", body },
        handoff: { type: "sale", customerId: customerId ?? null, customerName, paymentType, lines: detail, estimatedTotal: total, warnings },
      });
    },
  },
  anular_venta: {
    roles: [Roles.ADMIN],
    label: "Anular venta",
    spec: {
      name: "anular_venta",
      description: "Prepara la anulación de una venta (devuelve el stock a sus lotes y, si fue a crédito, baja la cartera). Use el id de buscar_venta.",
      input_schema: obj({ saleId: { type: "integer" } }, ["saleId"]),
    },
    run: async (i, ctx) => {
      const id = int(i["saleId"]);
      if (id === undefined) return { error: "saleId requerido" };
      const s = await getSale(id);
      if (s.status === "VOIDED") return { error: "La venta ya estaba anulada" };
      return propose(ctx, {
        type: "action",
        kind: "void_sale",
        title: `Anular venta ${s.invoiceNumber}`,
        lines: [`${s.customerName ?? "Consumidor final"} · ${s.paymentType === "CREDIT" ? "crédito" : "contado"} · ${money(s.total)}`, ...s.lines.map((l) => `${l.quantity} × ${l.productName}`)],
        warnings: ["La anulación no se puede deshacer."],
        confirmLabel: "Anular venta",
        request: { method: "POST", path: `/sales/${id}/void` },
      });
    },
  },

  /* ------------------------------------------------------------------ productos e inventario */
  crear_producto: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Nuevo producto",
    spec: {
      name: "crear_producto",
      description: "Prepara la creación de un producto: nombre, SKU, categoryId (ver categorias), precio de compra y de venta. El stock entra después con un lote o compra.",
      input_schema: obj({ name: { type: "string" }, sku: { type: "string" }, categoryId: { type: "integer" }, purchasePrice: { type: "number" }, salePrice: { type: "number" } }, ["name", "sku", "categoryId", "purchasePrice", "salePrice"]),
    },
    run: async (i, ctx) => {
      const body = clean({ name: str(i["name"]), sku: str(i["sku"])?.toUpperCase(), categoryId: int(i["categoryId"]), purchasePrice: num(i["purchasePrice"]), salePrice: num(i["salePrice"]) });
      const v = validate(parseCreateProduct, body);
      if (!v.ok) return v.error;
      const { rows } = await db.query<{ name: string }>(`SELECT name FROM categories WHERE id = $1`, [body["categoryId"]]);
      if (!rows[0]) return { error: "La categoría no existe" };
      const buy = Number(body["purchasePrice"]);
      const sell = Number(body["salePrice"]);
      return propose(ctx, {
        type: "action",
        kind: "create_product",
        title: "Crear producto",
        lines: [`${body["name"]} · ${body["sku"]}`, `Categoría: ${rows[0].name}`, `Compra ${money(buy)} · venta ${money(sell)}`],
        warnings: sell < buy ? ["El precio de venta es menor que el de compra."] : [],
        confirmLabel: "Crear producto",
        request: { method: "POST", path: "/products", body },
      });
    },
  },
  actualizar_producto: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Editar producto",
    spec: {
      name: "actualizar_producto",
      description: "Prepara cambios a un producto (nombre, SKU, categoría, precio de compra o de venta, activo). Envíe solo lo que cambia.",
      input_schema: obj({ productId: { type: "integer" }, name: { type: "string" }, sku: { type: "string" }, categoryId: { type: "integer" }, purchasePrice: { type: "number" }, salePrice: { type: "number" }, active: { type: "boolean" } }, ["productId"]),
    },
    run: async (i, ctx) => {
      const id = int(i["productId"]);
      const p = id !== undefined ? await findProductById(id) : undefined;
      if (!p || id === undefined) return { error: "Producto no encontrado" };
      const body = clean({ name: str(i["name"]), sku: str(i["sku"])?.toUpperCase(), categoryId: int(i["categoryId"]), purchasePrice: num(i["purchasePrice"]), salePrice: num(i["salePrice"]), active: typeof i["active"] === "boolean" ? i["active"] : undefined });
      if (Object.keys(body).length === 0) return { error: "No hay cambios" };
      const v = validate(parseUpdateProduct, body);
      if (!v.ok) return v.error;
      const from: Record<string, unknown> = { name: p.name, sku: p.sku, categoryId: p.categoryId, purchasePrice: p.purchasePrice, salePrice: p.salePrice, active: p.active };
      const labels: Record<string, string> = { name: "Nombre", sku: "SKU", categoryId: "Categoría (id)", purchasePrice: "Precio de compra", salePrice: "Precio de venta", active: "Activo" };
      const fmt = (k: string, val: unknown) => (k.endsWith("Price") ? money(Number(val)) : k === "active" ? yesNo(val) : String(val));
      return propose(ctx, {
        type: "action",
        kind: "update_product",
        title: `Editar producto: ${p.name}`,
        lines: Object.entries(body).map(([k, val]) => `${labels[k] ?? k}: ${fmt(k, from[k])} → ${fmt(k, val)}`),
        warnings: Number(body["salePrice"] ?? p.salePrice) < Number(body["purchasePrice"] ?? p.purchasePrice) ? ["El precio de venta queda por debajo del de compra."] : [],
        confirmLabel: "Guardar cambios",
        request: { method: "PUT", path: `/products/${id}`, body },
      });
    },
  },
  desactivar_producto: {
    roles: [Roles.ADMIN],
    label: "Desactivar producto",
    spec: { name: "desactivar_producto", description: "Prepara la desactivación de un producto (deja de venderse; su historial se conserva).", input_schema: obj({ productId: { type: "integer" } }, ["productId"]) },
    run: async (i, ctx) => {
      const id = int(i["productId"]);
      const p = id !== undefined ? await findProductById(id) : undefined;
      if (!p || id === undefined) return { error: "Producto no encontrado" };
      return propose(ctx, {
        type: "action",
        kind: "deactivate_product",
        title: `Desactivar ${p.name}`,
        lines: [`${p.sku} · stock físico ${p.stock}`],
        warnings: p.stock > 0 ? [`Todavía tiene ${p.stock} unidades en bodega.`] : [],
        confirmLabel: "Desactivar",
        request: { method: "DELETE", path: `/products/${id}` },
      });
    },
  },
  crear_categoria: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Nueva categoría",
    spec: { name: "crear_categoria", description: "Prepara una nueva categoría o línea de productos.", input_schema: obj({ name: { type: "string" } }, ["name"]) },
    run: async (i, ctx) => {
      const body = clean({ name: str(i["name"]) });
      const v = validate(parseCreateCategory, body);
      if (!v.ok) return v.error;
      return propose(ctx, { type: "action", kind: "create_category", title: "Crear categoría", lines: [String(body["name"])], warnings: [], confirmLabel: "Crear categoría", request: { method: "POST", path: "/categories", body } });
    },
  },
  registrar_lote: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Lote",
    spec: {
      name: "registrar_lote",
      description: "Prepara la entrada de un lote de un producto (cantidad y vencimiento; costo unitario y proveedor opcionales). Para compras a proveedor prefiera registrar_compra.",
      input_schema: obj({ productId: { type: "integer" }, quantity: { type: "integer" }, expiresAt: { type: "string", description: "YYYY-MM-DD, hoy o posterior" }, unitCost: { type: "number" }, supplierId: { type: "integer" } }, ["productId", "quantity", "expiresAt"]),
    },
    run: async (i, ctx) => {
      const id = int(i["productId"]);
      const p = id !== undefined ? await findProductById(id) : undefined;
      if (!p || id === undefined) return { error: "Producto no encontrado" };
      const body = clean({ quantity: int(i["quantity"]), expiresAt: isoDate(i["expiresAt"]), unitCost: num(i["unitCost"]), supplierId: int(i["supplierId"]) });
      const v = validate(parseCreateBatch, body);
      if (!v.ok) return v.error;
      if (String(body["expiresAt"]) < todayIso()) return { error: "El lote ya está vencido; no puede ingresar" };
      return propose(ctx, {
        type: "action",
        kind: "batch",
        title: `Entrada de lote: ${p.name}`,
        lines: [`${body["quantity"]} unidades · vence ${body["expiresAt"]}`, `Costo unitario: ${money(Number(body["unitCost"] ?? p.purchasePrice))}`],
        warnings: String(body["expiresAt"]) < addDaysIso(todayIso(), 30) ? ["Vence en menos de 30 días."] : [],
        confirmLabel: "Registrar lote",
        request: { method: "POST", path: `/products/${id}/batches`, body },
      });
    },
  },

  /* ------------------------------------------------------------------ proveedores */
  crear_proveedor: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Nuevo proveedor",
    spec: { name: "crear_proveedor", description: "Prepara la creación de un proveedor (nombre; NIT y teléfono opcionales).", input_schema: obj({ name: { type: "string" }, taxId: { type: "string" }, phone: { type: "string" } }, ["name"]) },
    run: async (i, ctx) => {
      const body = clean({ name: str(i["name"]), taxId: str(i["taxId"]), phone: str(i["phone"]) });
      const v = validate(parseCreateSupplier, body);
      if (!v.ok) return v.error;
      return propose(ctx, { type: "action", kind: "create_supplier", title: "Crear proveedor", lines: [String(body["name"]), `NIT: ${body["taxId"] ?? "—"} · Tel.: ${body["phone"] ?? "—"}`], warnings: [], confirmLabel: "Crear proveedor", request: { method: "POST", path: "/suppliers", body } });
    },
  },
  actualizar_proveedor: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Editar proveedor",
    spec: { name: "actualizar_proveedor", description: "Prepara cambios a un proveedor (nombre, NIT, teléfono, activo).", input_schema: obj({ supplierId: { type: "integer" }, name: { type: "string" }, taxId: { type: "string" }, phone: { type: "string" }, active: { type: "boolean" } }, ["supplierId"]) },
    run: async (i, ctx) => {
      const id = int(i["supplierId"]);
      const s = id !== undefined ? await findSupplierById(id) : undefined;
      if (!s || id === undefined) return { error: "Proveedor no encontrado" };
      const body = clean({ name: str(i["name"]), taxId: str(i["taxId"]), phone: str(i["phone"]), active: typeof i["active"] === "boolean" ? i["active"] : undefined });
      if (Object.keys(body).length === 0) return { error: "No hay cambios" };
      const v = validate(parseUpdateSupplier, body);
      if (!v.ok) return v.error;
      return propose(ctx, { type: "action", kind: "update_supplier", title: `Editar proveedor: ${s.name}`, lines: Object.entries(body).map(([k, val]) => `${k}: ${String(val)}`), warnings: [], confirmLabel: "Guardar cambios", request: { method: "PUT", path: `/suppliers/${id}`, body } });
    },
  },
  registrar_compra: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Compra",
    spec: {
      name: "registrar_compra",
      description: "Prepara una compra a proveedor: crea un lote del producto con su costo y vencimiento y sube el stock. Para varias líneas (por ejemplo, de una factura) llame la herramienta una vez por línea.",
      input_schema: obj({ supplierId: { type: "integer" }, productId: { type: "integer" }, quantity: { type: "integer" }, unitCost: { type: "number" }, expiresAt: { type: "string", description: "YYYY-MM-DD, hoy o posterior" } }, ["supplierId", "productId", "quantity", "unitCost", "expiresAt"]),
    },
    run: async (i, ctx) => {
      const supplierId = int(i["supplierId"]);
      const s = supplierId !== undefined ? await findSupplierById(supplierId) : undefined;
      if (!s || supplierId === undefined) return { error: "Proveedor no encontrado (consulte proveedores)" };
      const body = clean({ productId: int(i["productId"]), quantity: int(i["quantity"]), unitCost: num(i["unitCost"]), expiresAt: isoDate(i["expiresAt"]) });
      const v = validate(parseCreatePurchase, body);
      if (!v.ok) return v.error;
      if (String(body["expiresAt"]) < todayIso()) return { error: "El lote ya está vencido; no puede ingresar" };
      const p = await findProductById(Number(body["productId"]));
      if (!p) return { error: "Producto no encontrado" };
      const qty = Number(body["quantity"]);
      const cost = Number(body["unitCost"]);
      return propose(ctx, {
        type: "action",
        kind: "purchase",
        title: `Compra a ${s.name}`,
        lines: [`${qty} × ${p.name} a ${money(cost)} · ${money(qty * cost)}`, `Vence ${body["expiresAt"]}`],
        warnings: p.purchasePrice > 0 && Math.abs(cost - p.purchasePrice) / p.purchasePrice > 0.25 ? [`El costo difiere más de 25 % del registrado (${money(p.purchasePrice)}).`] : [],
        confirmLabel: "Registrar compra",
        request: { method: "POST", path: `/suppliers/${supplierId}/purchases`, body },
        handoff: { type: "purchase", supplierId, supplierName: s.name, productId: p.id, productName: p.name, quantity: qty, unitCost: cost, expiresAt: String(body["expiresAt"]) },
      });
    },
  },

  /* ------------------------------------------------------------------ finanzas, contactos y equipo */
  crear_escenario: {
    roles: [Roles.ADMIN],
    label: "Nuevo escenario",
    spec: {
      name: "crear_escenario",
      description:
        "Prepara un escenario de evaluación de la ampliación con crédito: nombre, inversión fija (pesos), porcentaje financiado (0 a 1), plazo en meses, aumento de ventas (fracción, 0.2 = 20 %), gastos adicionales al mes y si el crédito cubre el capital de trabajo. El servidor calcula VPN, TIR y demás al crearlo.",
      input_schema: obj(
        { name: { type: "string" }, fixedInvestment: { type: "number" }, creditPct: { type: "number" }, termMonths: { type: "integer" }, salesIncrease: { type: "number" }, additionalExpensesMonth: { type: "number" }, creditCoversWorkingCapital: { type: "boolean" } },
        ["name", "fixedInvestment", "creditPct", "termMonths", "salesIncrease", "additionalExpensesMonth"],
      ),
    },
    run: async (i, ctx) => {
      const body = clean({
        name: str(i["name"]),
        fixedInvestment: num(i["fixedInvestment"]),
        creditPct: num(i["creditPct"]),
        termMonths: int(i["termMonths"]),
        salesIncrease: num(i["salesIncrease"]),
        additionalExpensesMonth: num(i["additionalExpensesMonth"]),
        creditCoversWorkingCapital: typeof i["creditCoversWorkingCapital"] === "boolean" ? i["creditCoversWorkingCapital"] : undefined,
      });
      const v = validate(parseCreateScenario, body);
      if (!v.ok) return v.error;
      return propose(ctx, {
        type: "action",
        kind: "scenario",
        title: `Escenario: ${body["name"]}`,
        lines: [
          `Inversión ${money(Number(body["fixedInvestment"]))} · ${Math.round(Number(body["creditPct"]) * 100)} % con crédito a ${body["termMonths"]} meses`,
          `Ventas +${Math.round(Number(body["salesIncrease"]) * 100)} % · gastos adicionales ${money(Number(body["additionalExpensesMonth"]))} al mes`,
        ],
        warnings: [],
        confirmLabel: "Crear escenario",
        request: { method: "POST", path: "/financial/scenarios", body },
      });
    },
  },
  actualizar_contacto: {
    roles: [Roles.ADMIN],
    label: "Contacto del sitio",
    spec: { name: "actualizar_contacto", description: "Prepara el cambio de estado de un mensaje del sitio: READ (atendido) o ARCHIVED.", input_schema: obj({ contactId: { type: "integer" }, status: { type: "string", enum: ["NEW", "READ", "ARCHIVED"] } }, ["contactId", "status"]) },
    run: async (i, ctx) => {
      const id = int(i["contactId"]);
      const body = clean({ status: str(i["status"]) });
      const v = validate(parseUpdateContactMessage, body);
      if (!v.ok || id === undefined) return v.ok ? { error: "contactId requerido" } : v.error;
      const { rows } = await db.query<{ name: string }>(`SELECT name FROM contact_messages WHERE id = $1`, [id]);
      if (!rows[0]) return { error: "Mensaje no encontrado" };
      const label = body["status"] === "READ" ? "atendido" : body["status"] === "ARCHIVED" ? "archivado" : "por atender";
      return propose(ctx, { type: "action", kind: "contact", title: `Mensaje de ${rows[0].name}`, lines: [`Marcar como ${label}`], warnings: [], confirmLabel: "Guardar", request: { method: "PATCH", path: `/contact-messages/${id}`, body } });
    },
  },
  enviar_mensaje_equipo: {
    roles: ALL,
    label: "Chat del equipo",
    spec: {
      name: "enviar_mensaje_equipo",
      description: "Prepara un mensaje para el chat del equipo: al canal general o, con recipientId (ver equipo), privado a una persona.",
      input_schema: obj({ body: { type: "string" }, recipientId: { type: "integer" } }, ["body"]),
    },
    run: async (i, ctx) => {
      const body = clean({ body: str(i["body"]), recipientId: int(i["recipientId"]) });
      const v = validate(parseCreateChatMessage, body);
      if (!v.ok) return v.error;
      let to = "Canal general";
      if (body["recipientId"] !== undefined) {
        const { rows } = await db.query<{ name: string }>(`SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1 AND active`, [body["recipientId"]]);
        if (!rows[0]) return { error: "Esa persona no existe o está inactiva" };
        to = `Privado a ${rows[0].name}`;
      }
      return propose(ctx, { type: "action", kind: "chat", title: "Mensaje al equipo", lines: [to, `«${body["body"]}»`], warnings: [], confirmLabel: "Enviar mensaje", request: { method: "POST", path: "/chat/messages", body } });
    },
  },

  /* ------------------------------------------------------------------ reportes */
  generar_reporte: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Reportes",
    spec: {
      name: "generar_reporte",
      description:
        "Deja listo un reporte para abrir, imprimir en PDF o descargar en Excel: sales (ventas entre fechas, por día o por producto; ADMIN y SALES), inventory (inventario valorizado y vencimientos; solo ADMIN) o receivables (cartera; solo ADMIN).",
      input_schema: obj({ tipo: { type: "string", enum: ["sales", "inventory", "receivables"] }, desde: { type: "string" }, hasta: { type: "string" }, agruparPor: { type: "string", enum: ["day", "product"] }, dias: { type: "integer" } }, ["tipo"]),
    },
    run: async (i, ctx) => {
      const tipo = i["tipo"] === "inventory" || i["tipo"] === "receivables" ? i["tipo"] : "sales";
      if (tipo !== "sales" && ctx.role !== Roles.ADMIN) return { error: "Ese reporte no está disponible para su cuenta" };
      if (tipo === "sales") {
        const to = isoDate(i["hasta"]) ?? todayIso();
        const from = isoDate(i["desde"]) ?? addDaysIso(to, -29);
        if (from > to) return { error: "desde debe ser anterior a hasta" };
        const groupBy = i["agruparPor"] === "product" ? "product" : "day";
        return propose(ctx, { type: "report", report: "sales", title: "Reporte de ventas", lines: [`Del ${from} al ${to} · ${groupBy === "day" ? "por día" : "por producto"}`], params: { from, to, groupBy } });
      }
      const days = Math.min(Math.max(int(i["dias"]) ?? 30, 1), 365);
      return tipo === "inventory"
        ? propose(ctx, { type: "report", report: "inventory", title: "Reporte de inventario", lines: [`Vencimientos a ${days} días`], params: { days } })
        : propose(ctx, { type: "report", report: "receivables", title: "Reporte de cartera", lines: [`Vencida: más de ${days} días sin movimiento`], params: { overdueDays: days } });
    },
  },
};
