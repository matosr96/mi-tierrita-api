import type Anthropic from "@anthropic-ai/sdk";
import { addDaysIso, isDomainError, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import { Roles, type Role } from "../../security/index";
import { listCategories } from "../categories/index";
import { listContactMessages } from "../contact/index";
import { chatTeam } from "../chat/index";
import { listProducts, findProductById } from "../products/index";
import { listExpiringBatches, listProductBatches } from "../batches/index";
import { getCustomerBalance, listCustomers, findCustomerById } from "../customers/index";
import { inventoryReport, receivablesReport, salesReport } from "../reports/index";
import { getSale, listSales } from "../sales/index";
import { listSuppliers, findSupplierById } from "../suppliers/index";
import { getScenario, listScenarios } from "../financial/index";
import { computeInsights } from "./insights";
import { ACTION_TOOLS } from "./actions";
import { ALL, int, isoDate, obj, page, str, type ToolContext, type ToolDef } from "./tool-kit";

export type { Proposal, Source, ToolContext } from "./tool-kit";

/**
 * Herramientas de consulta de Tita. Cada una llama a la misma lógica de negocio que su endpoint y exige los mismos
 * roles (documento 06): el modelo nunca ve datos que la persona no podría ver en la app. Las de acción están en
 * actions.ts y no escriben: dejan una tarjeta que la persona confirma.
 */

const READ_TOOLS: Record<string, ToolDef> = {
  buscar_productos: {
    roles: ALL,
    label: "Inventario",
    spec: {
      name: "buscar_productos",
      description:
        "Busca productos activos por nombre o código (SKU). Devuelve precio de venta, stock físico y stock vendible (availableStock: lotes no vencidos). Sin texto, lista el catálogo.",
      input_schema: obj({ texto: { type: "string", description: "Parte del nombre o del SKU" } }),
    },
    run: async (i) => {
      const r = await listProducts(page(25), { active: true, search: str(i["texto"]) });
      return { total: r.count, productos: r.items.map((p) => ({ id: p.id, sku: p.sku, nombre: p.name, linea: p.categoryName, precioVenta: p.salePrice, precioCompra: p.purchasePrice, stockFisico: p.stock, stockVendible: p.availableStock })) };
    },
  },
  lotes_de_producto: {
    roles: ALL,
    label: "Lotes del producto",
    spec: {
      name: "lotes_de_producto",
      description: "Lotes de un producto con unidades restantes, costo, proveedor y vencimiento (FEFO: sale primero el que vence antes).",
      input_schema: obj({ productId: { type: "integer" } }, ["productId"]),
    },
    run: async (i) => {
      const id = int(i["productId"]);
      if (id === undefined) return { error: "productId requerido" };
      const r = await listProductBatches(id, page(30), { onlyAvailable: true });
      return { lotes: r.items.map((b) => ({ lote: b.id, restantes: b.quantityRemaining, costoUnitario: b.unitCost, proveedor: b.supplierName, vence: b.expiresAt, vencido: b.expired, diasParaVencer: b.daysToExpire })) };
    },
  },
  lotes_por_vencer: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Lotes y vencimientos",
    spec: {
      name: "lotes_por_vencer",
      description: "Lotes con existencias que vencen dentro de N días, más los ya vencidos que siguen en bodega.",
      input_schema: obj({ dias: { type: "integer", description: "Ventana en días (1 a 365). Por defecto 30." } }),
    },
    run: async (i) => {
      const days = Math.min(Math.max(int(i["dias"]) ?? 30, 1), 365);
      const r = await listExpiringBatches(page(40), days);
      return { dias: days, total: r.count, lotes: r.items.map((b) => ({ lote: b.id, producto: b.productName, restantes: b.quantityRemaining, costoUnitario: b.unitCost, vence: b.expiresAt, vencido: b.expired, diasParaVencer: b.daysToExpire })) };
    },
  },
  buscar_clientes: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Clientes y cartera",
    spec: {
      name: "buscar_clientes",
      description: "Busca clientes por nombre o documento. Devuelve cupo, saldo y crédito disponible.",
      input_schema: obj({ texto: { type: "string" }, conSaldo: { type: "boolean", description: "Solo los que deben" } }),
    },
    run: async (i) => {
      const r = await listCustomers(page(25), { active: true, search: str(i["texto"]), withBalance: i["conSaldo"] === true ? true : undefined });
      return { total: r.count, clientes: r.items.map((c) => ({ id: c.id, nombre: c.name, documento: c.documentId, telefono: c.phone, cupo: c.creditLimit, saldo: c.balance, disponible: c.availableCredit })) };
    },
  },
  saldo_cliente: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Saldo del cliente",
    spec: {
      name: "saldo_cliente",
      description: "Saldo, cupo, crédito disponible, última compra a crédito, último abono y si la cartera está vencida (más de 30 días sin movimiento).",
      input_schema: obj({ customerId: { type: "integer" } }, ["customerId"]),
    },
    run: async (i) => {
      const id = int(i["customerId"]);
      if (id === undefined) return { error: "customerId requerido" };
      return getCustomerBalance(id);
    },
  },
  resumen_ventas: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Reporte de ventas",
    spec: {
      name: "resumen_ventas",
      description:
        "Totales de ventas completadas en un rango de fechas (YYYY-MM-DD, hora de Colombia): número de ventas, unidades, total, contado, crédito, ticket promedio y filas por día o por producto.",
      input_schema: obj({ desde: { type: "string" }, hasta: { type: "string" }, agruparPor: { type: "string", enum: ["day", "product"] } }, ["desde", "hasta"]),
    },
    run: async (i) => {
      const to = isoDate(i["hasta"]) ?? todayIso();
      const from = isoDate(i["desde"]) ?? addDaysIso(to, -29);
      if (from > to) return { error: "desde debe ser anterior o igual a hasta" };
      const r = await salesReport(from, to, i["agruparPor"] === "product" ? "product" : "day");
      return { ...r, rows: r.rows.slice(0, 40) };
    },
  },
  ventas_recientes: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Historial de ventas",
    spec: {
      name: "ventas_recientes",
      description: "Lista de ventas (factura, fecha, cliente, forma de pago, total, estado), opcionalmente filtradas por fechas o cliente.",
      input_schema: obj({ desde: { type: "string" }, hasta: { type: "string" }, customerId: { type: "integer" } }),
    },
    run: async (i) => {
      const r = await listSales(page(20), { from: isoDate(i["desde"]), to: isoDate(i["hasta"]), customerId: int(i["customerId"]) });
      return { total: r.count, ventas: r.items.map((s) => ({ factura: s.invoiceNumber, fecha: s.createdAt, cliente: s.customerName ?? "Consumidor final", pago: s.paymentType, total: s.total, estado: s.status })) };
    },
  },
  reporte_inventario: {
    roles: [Roles.ADMIN],
    label: "Reporte de inventario",
    spec: {
      name: "reporte_inventario",
      description: "Inventario valorizado (a costo y a precio de venta), productos sin existencias, lotes por vencer y vencidos, por línea.",
      input_schema: obj({ dias: { type: "integer", description: "Ventana de vencimiento, por defecto 30" } }),
    },
    run: async (i) => inventoryReport(Math.min(Math.max(int(i["dias"]) ?? 30, 1), 365)),
  },
  reporte_cartera: {
    roles: [Roles.ADMIN],
    label: "Reporte de cartera",
    spec: {
      name: "reporte_cartera",
      description: "Cartera total y vencida (más de 30 días sin movimiento) con el detalle por cliente.",
      input_schema: obj({}),
    },
    run: async () => {
      const r = await receivablesReport(30);
      return { ...r, items: r.items.slice(0, 30) };
    },
  },
  proveedores: {
    roles: [Roles.ADMIN, Roles.WAREHOUSE],
    label: "Proveedores",
    spec: { name: "proveedores", description: "Proveedores activos con NIT y teléfono.", input_schema: obj({}) },
    run: async () => {
      const r = await listSuppliers(page(50), { active: true });
      return { proveedores: r.items.map((s) => ({ id: s.id, nombre: s.name, nit: s.taxId, telefono: s.phone })) };
    },
  },
  escenarios_financieros: {
    roles: [Roles.ADMIN],
    label: "Finanzas y crédito",
    spec: {
      name: "escenarios_financieros",
      description:
        "Escenarios de evaluación de la ampliación del local con crédito: sin id lista los escenarios con sus indicadores (VPN, TIR, recuperación, cuota); con id da los supuestos y resultados completos.",
      input_schema: obj({ id: { type: "integer" } }),
    },
    run: async (i) => {
      const id = int(i["id"]);
      if (id !== undefined) return getScenario(id);
      const r = await listScenarios(page(20));
      return { escenarios: r.items.map((s) => ({ id: s.id, nombre: s.name, inversion: s.fixedInvestment, credito: s.creditPct, plazoMeses: s.termMonths, aumentoVentas: s.salesIncrease, indicadores: s.indicators })) };
    },
  },
  categorias: {
    roles: ALL,
    label: "Categorías",
    spec: { name: "categorias", description: "Líneas o categorías de productos con su id (para crear o mover productos).", input_schema: obj({}) },
    run: async () => {
      const r = await listCategories({ page: 1, limit: 100, offset: 0 }, {});
      return { categorias: r.items.map((c) => ({ id: c.id, nombre: c.name, activa: c.active })) };
    },
  },
  buscar_venta: {
    roles: [Roles.ADMIN, Roles.SALES],
    label: "Historial de ventas",
    spec: {
      name: "buscar_venta",
      description: "Busca una venta por número de factura (por ejemplo FV-2026-000008) y devuelve su id, cliente, total, estado y líneas.",
      input_schema: obj({ factura: { type: "string" } }, ["factura"]),
    },
    run: async (i) => {
      const f = str(i["factura"]);
      if (!f) return { error: "factura requerida" };
      const { rows } = await db.query<{ id: number }>(`SELECT id FROM sales WHERE invoice_number ILIKE $1 ORDER BY id DESC LIMIT 1`, [`%${f.replace(/[%_]/g, "")}%`]);
      if (!rows[0]) return { error: "No hay una venta con esa factura" };
      const sale = await getSale(rows[0].id);
      return { id: sale.id, factura: sale.invoiceNumber, fecha: sale.createdAt, cliente: sale.customerName ?? "Consumidor final", pago: sale.paymentType, total: sale.total, estado: sale.status, lineas: sale.lines };
    },
  },
  contactos_del_sitio: {
    roles: [Roles.ADMIN],
    label: "Contactos del sitio",
    spec: { name: "contactos_del_sitio", description: "Mensajes del formulario de la página pública (nuevos, leídos o archivados) con su id.", input_schema: obj({ estado: { type: "string", enum: ["NEW", "READ", "ARCHIVED"] } }) },
    run: async (i) => {
      const status = i["estado"] === "READ" || i["estado"] === "ARCHIVED" || i["estado"] === "NEW" ? (i["estado"] as "NEW" | "READ" | "ARCHIVED") : undefined;
      const r = await listContactMessages(page(20), { status });
      return { mensajes: r.items.map((m) => ({ id: m.id, nombre: m.name, telefono: m.phone, tema: m.topic, mensaje: m.body, estado: m.status, fecha: m.createdAt })) };
    },
  },
  equipo: {
    roles: ALL,
    label: "Equipo",
    spec: { name: "equipo", description: "Personas del equipo con su id, rol y si están en línea (para enviarles un mensaje por el chat del equipo).", input_schema: obj({}) },
    run: async (_i, ctx) => {
      const t = await chatTeam(ctx.userId);
      return { personas: t.members.map((m) => ({ id: m.id, nombre: `${m.firstName} ${m.lastName}`, rol: m.role, enLinea: m.online })) };
    },
  },
  recomendaciones: {
    roles: ALL,
    label: "Recomendaciones",
    spec: {
      name: "recomendaciones",
      description:
        "Recomendaciones del día calculadas por el sistema para este rol: qué reponer (cobertura en días al ritmo de los últimos 30 días), lotes que no alcanzan a venderse antes de vencer (sobrante), a quién cobrar primero y productos quietos (sin ventas en 60 días).",
      input_schema: obj({}),
    },
    run: async (_i, ctx) => ({ recomendaciones: await computeInsights(ctx.role, 8) }),
  },
};

const TOOLS: Record<string, ToolDef> = { ...READ_TOOLS, ...ACTION_TOOLS };

/** Definiciones de las herramientas que puede usar este rol. */
export const toolsFor = (role: Role): Anthropic.Tool[] => Object.values(TOOLS).filter((t) => t.roles.includes(role)).map((t) => t.spec);

/** Ejecuta una herramienta respetando el rol; los errores de dominio vuelven al modelo como texto, no rompen la conversación. */
export const runTool = async (name: string, input: unknown, ctx: ToolContext): Promise<{ content: string; isError: boolean }> => {
  const tool = TOOLS[name];
  if (!tool || !tool.roles.includes(ctx.role)) return { content: JSON.stringify({ error: "Herramienta no disponible para este rol" }), isError: true };
  try {
    const result = await tool.run((input ?? {}) as Record<string, unknown>, ctx);
    if (!ctx.sources.some((s) => s.tool === name)) ctx.sources.push({ tool: name, label: tool.label });
    return { content: JSON.stringify(result), isError: typeof result === "object" && result !== null && "error" in result };
  } catch (err) {
    if (isDomainError(err)) return { content: JSON.stringify({ error: `Código ${err.code}` }), isError: true };
    throw err;
  }
};
