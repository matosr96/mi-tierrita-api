/**
 * Datos de ejemplo (brief de octubre de 2026, punto 39).
 *   pnpm db:seed            → crea los datos demo que falten; los que ya existen se dejan igual (idempotente)
 *   SEED_ON_START=true      → el servidor lo ejecuta al arrancar, después de db.ping() (ver server/index.ts)
 *
 * Qué crea: 3 usuarios `demo.*` (uno por rol, clave Demo-2026), las 6 líneas de la página pública (`product-lines.ts`,
 * con código, descripción y subfamilias), 56 productos `DEMO-…`, 5 proveedores,
 * lotes (lejanos, por vencer en 3/10/25 días y vencidos), 28 clientes, ventas de contado y a crédito de los últimos
 * 120 días con anulaciones y abonos, 3 escenarios financieros, 2 proyectos del simulador, 34 mensajes del chat (hilo, cita, fijado, privados y
 * 3 adjuntos reales guardados en la base), 3 mensajes de contacto, 5 exportaciones de reportes, 4 pedidos (a proveedores
 * y de clientes, con fechas de los próximos días), 3 empleados con la quincena en curso en borrador y 2 conteos de
 * inventario programados.
 *
 * Usa la lógica de negocio real (registerSale aplica FEFO y mueve stock y cartera; registerBatch valida vencimientos;
 * createChatMessage crea acuses y menciones). Como esa lógica fecha todo con `now()`, las fechas históricas se
 * ajustan después con UPDATE. Todo registro se identifica por una clave natural (username, SKU, NIT, documento,
 * nombre del escenario, `clientId` del mensaje, instante de la venta…); nada se borra ni se modifica si ya existe.
 * No necesita red ni ANTHROPIC_API_KEY. El ancla de fechas es el día en que se creó `demo.admin`: al volver a correr
 * el seed otro día no aparecen ventas nuevas.
 */
import { addDaysIso, todayIso } from "../common/dates";
import { db } from "../data-sources/db";
import { registerBatch } from "../business-logic/batches/register-batch";
import { createCategory } from "../business-logic/categories/create-category";
import { createChatMessage } from "../business-logic/chat/create-message";
import { uploadChatAttachment } from "../business-logic/chat/attachments";
import { setChatPin } from "../business-logic/chat/pin-message";
import { createContactMessage } from "../business-logic/contact/create-contact-message";
import { createCustomer } from "../business-logic/customers/create-customer";
import { registerPayment } from "../business-logic/customers/register-payment";
import { createScenario } from "../business-logic/financial/create-scenario";
import { saveProject } from "../business-logic/financial/save-project";
import { createProduct } from "../business-logic/products/create-product";
import { recordExport } from "../business-logic/reports/record-export";
import { registerSale } from "../business-logic/sales/register-sale";
import { voidSale } from "../business-logic/sales/void-sale";
import { createSupplier } from "../business-logic/suppliers/create-supplier";
import { registerPurchase } from "../business-logic/suppliers/register-purchase";
import { createUser } from "../business-logic/users/create-user";
import { findUserByUsername } from "../business-logic/users/find-user";
import { createOrder } from "../business-logic/orders/create-order";
import { createPayrollEmployee } from "../business-logic/payroll/create-employee";
import { createPayrollPeriod } from "../business-logic/payroll/create-period";
import { createStockCount } from "../business-logic/stock-counts/create-stock-count";
import {
  DEMO_PASSWORD,
  SALES_DAYS,
  atBusinessTime,
  currentFortnight,
  demoCounts,
  demoEmployees,
  demoOrders,
  demoBatchPlan,
  demoLines,
  demoChatScript,
  demoClientId,
  demoContactMessages,
  demoCustomers,
  demoFile,
  demoProducts,
  demoReportExports,
  demoSalesPlan,
  demoScenarios,
  demoProjects,
  demoSuppliers,
  demoUsers,
} from "./seed-data";

export type SeedCounter = { created: number; skipped: number };
export type SeedSummary = Record<string, SeedCounter>;

const ORDER = ["usuarios", "categorías", "proveedores", "productos", "clientes", "lotes", "ventas", "anulaciones", "abonos", "escenarios", "proyectos", "adjuntos", "mensajes", "contactos", "exportaciones", "pedidos", "empleados", "nómina", "conteos"];

const idOf = async (sql: string, params: unknown[]): Promise<number | undefined> => (await db.query<{ id: number }>(sql, params)).rows[0]?.id;

/** Fecha con la que "nacieron" los datos de catálogo: antes de la primera venta del plan. */
const backdate = (table: string, id: number, isoDate: string): Promise<unknown> => db.query(`UPDATE ${table} SET created_at = $2::date WHERE id = $1`, [id, isoDate]);

export const runSeed = async (): Promise<SeedSummary> => {
  const summary: SeedSummary = Object.fromEntries(ORDER.map((k) => [k, { created: 0, skipped: 0 }]));
  const count = (key: string, created: boolean): void => {
    const c = summary[key]!;
    if (created) c.created++;
    else c.skipped++;
  };
  const started = Date.now();

  // ---------------------------------------------------------------- usuarios (clave natural: username)
  const userIds = new Map<string, number>();
  const userRoles = new Map<string, "ADMIN" | "SALES" | "WAREHOUSE">();
  let anchorDate: Date | undefined;
  for (const u of demoUsers()) {
    let row = await findUserByUsername(u.username);
    if (row === undefined) {
      await createUser({ firstName: u.firstName, lastName: u.lastName, username: u.username, password: DEMO_PASSWORD, role: u.role });
      row = await findUserByUsername(u.username);
      if (row === undefined) throw new Error(`No se pudo crear el usuario demo ${u.username}`);
      await db.query(`UPDATE users SET email = $2, phone = $3 WHERE id = $1`, [row.id, u.email, u.phone]);
      count("usuarios", true);
    } else count("usuarios", false);
    userIds.set(u.username, row.id);
    userRoles.set(u.username, row.role);
    if (u.username === "demo.admin") anchorDate = row.createdAt;
  }
  const uid = (username: string): number => userIds.get(username)!;
  const adminId = uid("demo.admin");
  // Ancla de fechas: el día en que nació demo.admin (hoy en la primera ejecución).
  const anchor = todayIso(anchorDate ?? new Date());
  const catalogDate = todayIso(new Date(atBusinessTime(anchor, 12, 0).getTime() - (SALES_DAYS + 12) * 86_400_000));

  // ---------------------------------------------------------------- líneas (código, luego nombre) y proveedores (NIT)
  // Las seis líneas de la página pública (migración 0018). Si ya existe la fila con ese código se respeta tal cual
  // (el administrador pudo renombrarla); si solo existe por nombre (base anterior a la migración) se le completa el
  // código, la descripción y las subfamilias; si no existe, se crea con todo.
  const categoryIds = new Map<string, number>();
  for (const line of demoLines()) {
    let id = await idOf(`SELECT id FROM categories WHERE code = $1`, [line.code]);
    if (id === undefined) {
      id = await idOf(`SELECT id FROM categories WHERE lower(name) = lower($1)`, [line.name]);
      if (id !== undefined) {
        await db.query(`UPDATE categories SET code = $2, description = COALESCE(description, $3), tags = CASE WHEN cardinality(tags) = 0 THEN $4::text[] ELSE tags END WHERE id = $1`, [id, line.code, line.description, line.tags]);
      }
    }
    if (id === undefined) {
      id = (await createCategory({ name: line.name, description: line.description, tags: [...line.tags] })).id;
      await db.query(`UPDATE categories SET code = $2 WHERE id = $1`, [id, line.code]);
      await backdate("categories", id, catalogDate);
      count("categorías", true);
    } else count("categorías", false);
    categoryIds.set(line.name, id);
  }
  const supplierIds = new Map<string, number>();
  for (const s of demoSuppliers()) {
    let id = await idOf(`SELECT id FROM suppliers WHERE tax_id = $1`, [s.taxId]);
    if (id === undefined) {
      id = (await createSupplier({ name: s.name, taxId: s.taxId, phone: s.phone })).id;
      await backdate("suppliers", id, catalogDate);
      count("proveedores", true);
    } else count("proveedores", false);
    supplierIds.set(s.taxId, id);
  }

  // ---------------------------------------------------------------- productos (SKU)
  const products = demoProducts();
  const productIds = new Map<string, number>();
  for (const p of products) {
    let id = await idOf(`SELECT id FROM products WHERE lower(sku) = lower($1)`, [p.sku]);
    if (id === undefined) {
      id = (await createProduct({ name: p.name, sku: p.sku, categoryId: categoryIds.get(p.category)!, purchasePrice: p.purchasePrice, salePrice: p.salePrice })).id;
      await db.query(`UPDATE products SET created_at = $2::date, updated_at = $2::date WHERE id = $1`, [id, catalogDate]);
      count("productos", true);
    } else count("productos", false);
    productIds.set(p.sku, id);
  }

  // ---------------------------------------------------------------- clientes (documento)
  const customers = demoCustomers();
  const customerIds = new Map<string, number>();
  for (const c of customers) {
    let id = await idOf(`SELECT id FROM customers WHERE document_id = $1`, [c.documentId]);
    if (id === undefined) {
      id = (await createCustomer({ name: c.name, documentId: c.documentId, phone: c.phone, creditLimit: c.creditLimit })).id;
      await backdate("customers", id, catalogDate);
      count("clientes", true);
    } else count("clientes", false);
    customerIds.set(c.documentId, id);
  }

  // ---------------------------------------------------------------- lotes (producto + cantidad + vencimiento + proveedor)
  const plan = demoSalesPlan(anchor, products, customers);
  const batches = demoBatchPlan(anchor, products, plan.demand);
  const today = todayIso();
  const registerDemoBatch = async (b: (typeof batches)[number]): Promise<void> => {
    const productId = productIds.get(b.sku)!;
    const supplierId = supplierIds.get(b.supplierTaxId)!;
    const exists = await idOf(`SELECT id FROM product_batches WHERE product_id = $1 AND quantity = $2 AND expires_at = $3::date AND supplier_id = $4`, [productId, b.quantity, b.expiresAt, supplierId]);
    if (exists !== undefined) {
      count("lotes", false);
      return;
    }
    // La lógica real rechaza un lote que llega vencido: se registra con una fecha válida y luego se fecha como corresponde.
    const expiresAt = b.expiresAt < today ? today : b.expiresAt;
    const batch = await registerPurchase(supplierId, { productId, quantity: b.quantity, unitCost: b.unitCost, expiresAt });
    await db.query(`UPDATE product_batches SET expires_at = $2::date, created_at = $3::date WHERE id = $1`, [batch.id, b.expiresAt, todayIso(new Date(atBusinessTime(anchor, 12, 0).getTime() - b.createdDaysAgo * 86_400_000))]);
    count("lotes", true);
  };
  // Primero los lotes lejanos: FEFO vendería antes los que vencen pronto y los dejaría vacíos.
  for (const b of batches.filter((b) => b.kind === "far")) await registerDemoBatch(b);

  // ---------------------------------------------------------------- ventas, anulaciones y abonos (usuario + instante)
  const saleIds = new Map<number, number>();
  const { rows: existingSales } = await db.query<{ id: number; userId: number; createdAt: Date; status: string }>(
    `SELECT id, user_id AS "userId", created_at AS "createdAt", status FROM sales WHERE user_id = ANY($1::bigint[])`,
    [[...userIds.values()]],
  );
  const saleByKey = new Map(existingSales.map((s) => [`${s.userId}@${s.createdAt.getTime()}`, s]));
  const { rows: existingPayments } = await db.query<{ customerId: number; createdAt: Date }>(
    `SELECT customer_id AS "customerId", created_at AS "createdAt" FROM customer_payments WHERE user_id = ANY($1::bigint[])`,
    [[...userIds.values()]],
  );
  const paymentKeys = new Set(existingPayments.map((p) => `${p.customerId}@${p.createdAt.getTime()}`));
  for (const ev of plan.events) {
    if (ev.kind === "sale") {
      const key = `${uid(ev.username)}@${ev.at.getTime()}`;
      const existing = saleByKey.get(key);
      if (existing !== undefined) {
        saleIds.set(ev.ref, existing.id);
        count("ventas", false);
        continue;
      }
      // Si la cartera real no cuadra con el plan (una corrida anterior a medias), la venta se hace de contado.
      let paymentType = ev.paymentType;
      if (paymentType === "CREDIT" && ev.customerDocument !== null) {
        const { rows } = await db.query<{ balance: number; creditLimit: number }>(`SELECT balance, credit_limit AS "creditLimit" FROM customers WHERE id = $1`, [customerIds.get(ev.customerDocument)!]);
        if (rows[0] !== undefined && rows[0].balance + ev.total > rows[0].creditLimit) paymentType = "CASH";
      }
      const sale = await registerSale(uid(ev.username), {
        customerId: ev.customerDocument === null ? undefined : customerIds.get(ev.customerDocument)!,
        paymentType,
        lines: ev.lines.map((l) => ({ productId: productIds.get(l.sku)!, quantity: l.quantity })),
      });
      await db.query(`UPDATE sales SET created_at = $2 WHERE id = $1`, [sale.id, ev.at]);
      saleIds.set(ev.ref, sale.id);
      count("ventas", true);
    } else if (ev.kind === "void") {
      const saleId = saleIds.get(ev.ref);
      if (saleId === undefined) continue;
      const already = (await db.query<{ status: string }>(`SELECT status FROM sales WHERE id = $1`, [saleId])).rows[0]?.status === "VOIDED";
      if (already) {
        count("anulaciones", false);
        continue;
      }
      await voidSale(saleId, uid(ev.username));
      await db.query(`UPDATE sales SET voided_at = $2 WHERE id = $1`, [saleId, ev.at]);
      count("anulaciones", true);
    } else {
      const customerId = customerIds.get(ev.customerDocument)!;
      if (paymentKeys.has(`${customerId}@${ev.at.getTime()}`)) {
        count("abonos", false);
        continue;
      }
      // Si la base no cuadra con el plan (una corrida anterior a medias), el abono se limita al saldo real.
      const balance = (await db.query<{ balance: number }>(`SELECT balance FROM customers WHERE id = $1`, [customerId])).rows[0]?.balance ?? 0;
      const amount = Math.min(ev.amount, balance);
      if (amount <= 0) {
        count("abonos", false);
        continue;
      }
      const payment = await registerPayment(customerId, uid(ev.username), { amount });
      await db.query(`UPDATE customer_payments SET created_at = $2 WHERE id = $1`, [payment.id, ev.at]);
      count("abonos", true);
    }
  }
  // Ahora los lotes por vencer y los vencidos, que deben conservar sus unidades.
  for (const b of batches.filter((b) => b.kind !== "far")) await registerDemoBatch(b);

  // ---------------------------------------------------------------- escenarios financieros (nombre)
  for (const s of demoScenarios()) {
    const exists = await idOf(`SELECT id FROM financial_scenarios WHERE name = $1`, [s.name]);
    if (exists !== undefined) {
      count("escenarios", false);
      continue;
    }
    await createScenario(adminId, { name: s.name, input: s.input });
    count("escenarios", true);
  }

  // ---------------------------------------------------------------- proyectos del simulador (nombre)
  for (const p of demoProjects()) {
    const exists = await idOf(`SELECT id FROM financial_projects WHERE name = $1`, [p.name]);
    if (exists !== undefined) {
      count("proyectos", false);
      continue;
    }
    await saveProject(adminId, { name: p.name, input: p.input });
    count("proyectos", true);
  }

  // ---------------------------------------------------------------- chat del equipo (clientId determinista)
  const messageIds = new Map<string, number>();
  for (const m of demoChatScript()) {
    const authorId = uid(m.from);
    const clientId = demoClientId(m.key);
    const existing = await idOf(`SELECT id FROM chat_messages WHERE user_id = $1 AND client_id = $2`, [authorId, clientId]);
    if (existing !== undefined) {
      messageIds.set(m.key, existing);
      count("mensajes", false);
      if (m.attachment !== undefined) count("adjuntos", false);
      continue;
    }
    const attachmentIds: number[] = [];
    if (m.attachment !== undefined) {
      const file = demoFile(m.attachment);
      const uploaded = await uploadChatAttachment(authorId, { name: file.name, mime: file.mime, data: file.data, durationMs: null });
      attachmentIds.push(uploaded.id);
      count("adjuntos", true);
    }
    const created = await createChatMessage(authorId, {
      body: m.body,
      recipientId: m.to === undefined ? null : uid(m.to),
      replyToId: m.replyTo === undefined ? null : (messageIds.get(m.replyTo) ?? null),
      threadRootId: m.threadRoot === undefined ? null : (messageIds.get(m.threadRoot) ?? null),
      attachmentIds,
      clientId,
    });
    const [hour, minute] = m.time.split(":").map(Number) as [number, number];
    const at = atBusinessTime(todayIso(new Date(atBusinessTime(anchor, 12, 0).getTime() - m.daysAgo * 86_400_000)), hour, minute);
    await db.query(`UPDATE chat_messages SET created_at = $2 WHERE id = $1`, [created.id, at]);
    await db.query(`UPDATE chat_attachments SET created_at = $2 WHERE message_id = $1`, [created.id, at]);
    // Los demás usuarios demo ya lo recibieron y leyeron (salvo lo de hoy, que queda sin leer para verse en la app).
    if (m.daysAgo > 0) {
      await db.query(`UPDATE chat_receipts SET delivered_at = $2, read_at = $2 WHERE message_id = $1 AND user_id = ANY($3::bigint[])`, [created.id, new Date(at.getTime() + 60_000), [...userIds.values()]]);
    }
    if (m.pinned === true) await setChatPin({ userId: adminId, role: "ADMIN" }, created.id, true);
    messageIds.set(m.key, created.id);
    count("mensajes", true);
  }

  // ---------------------------------------------------------------- contacto del sitio (correo)
  for (const c of demoContactMessages()) {
    const exists = await idOf(`SELECT id FROM contact_messages WHERE email = $1`, [c.email]);
    if (exists !== undefined) {
      count("contactos", false);
      continue;
    }
    await createContactMessage({ name: c.name, phone: c.phone, email: c.email, topic: c.topic, body: c.body, trap: false });
    count("contactos", true);
  }

  // ---------------------------------------------------------------- exportaciones de reportes (usuario + reporte + formato + descripción)
  for (const e of demoReportExports(anchor)) {
    const userId = uid(e.username);
    const exists = await idOf(`SELECT id FROM report_exports WHERE user_id = $1 AND report = $2 AND format = $3 AND description = $4`, [userId, e.report, e.format, e.description]);
    if (exists !== undefined) {
      count("exportaciones", false);
      continue;
    }
    await recordExport(userId, userRoles.get(e.username) ?? e.role, { report: e.report, format: e.format, description: e.description, filters: e.filters, summary: e.summary });
    count("exportaciones", true);
  }

  // ---------------------------------------------------------------- pedidos (nota), alrededor de hoy para verlos en el calendario
  const nowDay = todayIso();
  const demoSupplierIds = (await db.query<{ id: number }>(`SELECT id FROM suppliers WHERE tax_id LIKE 'DEMO-%' ORDER BY id`)).rows.map((r) => r.id);
  const demoCustomerIds = (await db.query<{ id: number }>(`SELECT id FROM customers WHERE document_id LIKE 'DEMO-%' ORDER BY id`)).rows.map((r) => r.id);
  const demoProductIds = (await db.query<{ id: number }>(`SELECT id FROM products WHERE sku LIKE 'DEMO-%' ORDER BY sku`)).rows.map((r) => r.id);
  for (const o of demoOrders()) {
    if ((await idOf(`SELECT id FROM orders WHERE note = $1`, [o.note])) !== undefined) {
      count("pedidos", false);
      continue;
    }
    const counterpart = o.kind === "SUPPLIER" ? demoSupplierIds[o.counterpartIndex % Math.max(1, demoSupplierIds.length)] : demoCustomerIds[o.counterpartIndex % Math.max(1, demoCustomerIds.length)];
    const lines = o.lines.map((l) => ({ productId: demoProductIds[l.productIndex % Math.max(1, demoProductIds.length)]!, quantity: l.quantity }));
    if (counterpart === undefined || lines.some((l) => l.productId === undefined)) continue;
    await createOrder(uid("demo.admin"), "ADMIN", {
      kind: o.kind,
      ...(o.kind === "SUPPLIER" ? { supplierId: counterpart } : { customerId: counterpart }),
      dueDate: addDaysIso(nowDay, o.dueInDays),
      note: o.note,
      lines,
    });
    count("pedidos", true);
  }

  // ---------------------------------------------------------------- nómina: empleados (documento) y la quincena en curso (frecuencia + inicio)
  for (const e of demoEmployees()) {
    if ((await idOf(`SELECT id FROM payroll_employees WHERE document_id = $1`, [e.documentId])) !== undefined) {
      count("empleados", false);
      continue;
    }
    const linked = e.username !== null && userIds.has(e.username) ? uid(e.username) : undefined;
    const taken = linked !== undefined && (await idOf(`SELECT id FROM payroll_employees WHERE user_id = $1`, [linked])) !== undefined;
    await createPayrollEmployee({ firstName: e.firstName, lastName: e.lastName, documentId: e.documentId, position: e.position, baseSalary: e.baseSalary, payFrequency: e.payFrequency, ...(linked !== undefined && !taken ? { userId: linked } : {}) });
    count("empleados", true);
  }
  const fortnight = currentFortnight(nowDay);
  if ((await idOf(`SELECT id FROM payroll_periods WHERE frequency = 'BIWEEKLY' AND period_start = $1`, [fortnight.periodStart])) !== undefined) count("nómina", false);
  else {
    await createPayrollPeriod({ frequency: "BIWEEKLY", ...fortnight }, uid("demo.admin"));
    count("nómina", true);
  }

  // ---------------------------------------------------------------- conteos de inventario (título)
  for (const c of demoCounts()) {
    if ((await idOf(`SELECT id FROM stock_counts WHERE title = $1`, [c.title])) !== undefined) {
      count("conteos", false);
      continue;
    }
    const categoryId = c.categoryName === null ? null : ((await idOf(`SELECT id FROM categories WHERE name = $1`, [c.categoryName])) ?? null);
    await createStockCount(uid("demo.bodega"), { title: c.title, scheduledDate: addDaysIso(nowDay, c.inDays), scope: categoryId === null ? "ALL" : "CATEGORY", categoryId, note: "Conteo de ejemplo" });
    count("conteos", true);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Datos de ejemplo (ancla ${anchor}, ${seconds} s):`);
  for (const key of ORDER) {
    const c = summary[key]!;
    console.log(`  ${key.padEnd(14)} creados ${String(c.created).padStart(4)}   ya existían ${String(c.skipped).padStart(4)}`);
  }
  return summary;
};

if (require.main === module) {
  runSeed()
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void db.close());
}
