import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDue, summarizeDue, type DueBatch, type DueReceivable } from "../src/business-logic/notifications/due-items";
import { toClient } from "../src/business-logic/chat/realtime";

const batches: DueBatch[] = [
  { id: 1, productName: "Concentrado", quantityRemaining: 4, expiresAt: "2026-10-27", daysToExpire: -2 },
  { id: 2, productName: "Vitaminas", quantityRemaining: 10, expiresAt: "2026-11-03", daysToExpire: 5 },
  { id: 3, productName: "Sal", quantityRemaining: 0, expiresAt: "2026-10-20", daysToExpire: -9 },
  { id: 4, productName: "Melaza", quantityRemaining: 2, expiresAt: "2026-11-20", daysToExpire: 22 },
];
const receivables: DueReceivable[] = [
  { customerId: 10, name: "Finca La Esperanza", balance: 250_000, lastCreditSaleAt: "2026-09-20T15:00:00.000Z", overdue: true },
  { customerId: 11, name: "Don Pedro", balance: 80_000, lastCreditSaleAt: "2026-10-02T15:00:00.000Z", overdue: false },
  { customerId: 12, name: "Reciente", balance: 50_000, lastCreditSaleAt: "2026-10-25T15:00:00.000Z", overdue: false },
  { customerId: 13, name: "Sin crédito", balance: 10_000, lastCreditSaleAt: null, overdue: false },
];
const opts = { overdueDays: 30, today: "2026-10-29" };

test("classifyDue: el administrador ve lotes y cartera; vencidos primero", () => {
  const items = classifyDue("ADMIN", batches, receivables, opts);
  assert.deepEqual(
    items.map((i) => `${i.kind}:${i.id}`),
    ["batch_expired:1", "receivable_overdue:10", "batch_expiring:2", "receivable_due_soon:11"],
  );
  const soon = items.find((i) => i.kind === "receivable_due_soon");
  // Última venta a crédito 02/10 + 30 días = 01/11; a 3 días, dentro de la ventana de 5.
  assert.equal(soon?.dueOn, "2026-11-01");
  assert.equal(soon?.href, "/clientes");
  assert.equal(items.find((i) => i.kind === "batch_expired")?.dueOn, "2026-10-27");
  assert.equal(items.find((i) => i.kind === "batch_expiring")?.href, "/lotes");
  assert.match(items[0]!.detail, /hace 2 días/);
});

test("classifyDue: bodega solo lotes, secretaría solo cartera", () => {
  const w = classifyDue("WAREHOUSE", batches, receivables, opts);
  assert.ok(w.every((i) => i.kind.startsWith("batch_")));
  assert.equal(w.length, 2);
  const s = classifyDue("SALES", batches, receivables, opts);
  assert.ok(s.every((i) => i.kind.startsWith("receivable_")));
  assert.equal(s.length, 2);
});

test("classifyDue: la ventana de cobros por vencer es de 5 días y respeta la regla de vencido", () => {
  const r: DueReceivable[] = [{ customerId: 1, name: "A", balance: 1, lastCreditSaleAt: "2026-10-05T00:00:00.000Z", overdue: false }];
  // 05/10 + 30 = 04/11; a 6 días (29/10) todavía no; a 5 (30/10) sí.
  assert.equal(classifyDue("SALES", [], r, { overdueDays: 30, today: "2026-10-29" }).length, 0);
  assert.equal(classifyDue("SALES", [], r, { overdueDays: 30, today: "2026-10-30" }).length, 1);
  assert.equal(classifyDue("SALES", [], r, { overdueDays: 30, today: "2026-10-30", dueSoonDays: 2 }).length, 0);
});

test("summarizeDue cuenta por tipo en una línea", () => {
  assert.equal(summarizeDue(classifyDue("ADMIN", batches, receivables, opts)), "1 lote vencido · 1 lote por vencer · 1 cliente con cartera vencida · 1 cobro por vencer");
  assert.equal(summarizeDue([]), "Sin vencimientos pendientes");
});

test("evento en vivo `due`: resumen por persona", () => {
  const event = { kind: "due" as const, audience: [5], count: 3, summary: "2 lotes por vencer · 1 cobro por vencer" };
  assert.deepEqual(toClient(event, 5), { type: "due", count: 3, summary: "2 lotes por vencer · 1 cobro por vencer" });
});

/* ---------- Pedidos, nómina y conteos en los avisos por rol ---------- */
import type { DueOrder } from "../src/business-logic/orders/list-due-orders";
import type { ScheduledCount, UpcomingPayroll } from "../src/models/index";

const dueOrder = (over: Partial<DueOrder>): DueOrder => ({
  id: 1, kind: "SUPPLIER", status: "PENDING", dueDate: "2026-10-30", counterpartName: "Agroinsumos", supplierId: 3, customerId: null,
  total: 100_000, lineCount: 2, pendingUnits: 12, daysToDue: 1, overdue: false, href: "/pedidos?pedido=1", ...over,
});
const extras = {
  orders: [
    dueOrder({ id: 1 }),
    dueOrder({ id: 2, kind: "CUSTOMER", counterpartName: "Finca La Esperanza", supplierId: null, customerId: 9, dueDate: "2026-10-27", daysToDue: -2, overdue: true, href: "/pedidos?pedido=2" }),
    dueOrder({ id: 3, dueDate: "2026-11-04", daysToDue: 6 }),
  ],
  payroll: [
    { id: 9, frequency: "BIWEEKLY", periodStart: "2026-10-16", periodEnd: "2026-10-31", payDate: "2026-10-30", status: "DRAFT", totalNet: 2_281_000 },
    { id: 10, frequency: "MONTHLY", periodStart: "2026-11-01", periodEnd: "2026-11-30", payDate: "2026-11-30", status: "DRAFT", totalNet: 1_000_000 },
  ] as UpcomingPayroll[],
  counts: [
    { id: 4, title: "Conteo general", scheduledDate: "2026-10-30", status: "PLANNED", scope: "ALL", categoryId: null, categoryName: null, overdue: false },
    { id: 5, title: "Medicina veterinaria", scheduledDate: "2026-10-28", status: "PLANNED", scope: "CATEGORY", categoryId: 2, categoryName: "Medicina veterinaria", overdue: true },
    { id: 6, title: "Lejano", scheduledDate: "2026-11-20", status: "PLANNED", scope: "ALL", categoryId: null, categoryName: null, overdue: false },
  ] as ScheduledCount[],
};
const dueOpts = { overdueDays: 30, today: "2026-10-29" };

test("GET /notifications/due: pedidos por rol (proveedor para bodega, cliente para caja) atrasados o a 2 días", () => {
  const ids = (role: "ADMIN" | "SALES" | "WAREHOUSE") => classifyDue(role, [], [], dueOpts, extras).filter((i) => i.kind.startsWith("order_")).map((i) => `${i.kind}:${i.id}`);
  assert.deepEqual(ids("WAREHOUSE"), ["order_due_soon:1"]);
  assert.deepEqual(ids("SALES"), ["order_overdue:2"]);
  assert.deepEqual(ids("ADMIN").sort(), ["order_due_soon:1", "order_overdue:2"]);
  const late = classifyDue("ADMIN", [], [], dueOpts, extras).find((i) => i.kind === "order_overdue")!;
  assert.match(late.detail, /hace 2 días/);
  assert.equal(late.href, "/pedidos?pedido=2");
});

test("GET /notifications/due: la nómina solo la ve administración, desde 3 días antes del pago", () => {
  const admin = classifyDue("ADMIN", [], [], dueOpts, extras).filter((i) => i.kind === "payroll_due");
  assert.deepEqual(admin.map((i) => i.id), [9]);
  assert.match(admin[0]!.title, /mañana/);
  assert.equal(admin[0]!.href, "/nomina?periodo=9");
  assert.equal(classifyDue("SALES", [], [], dueOpts, extras).some((i) => i.kind === "payroll_due"), false);
  assert.equal(classifyDue("WAREHOUSE", [], [], dueOpts, extras).some((i) => i.kind === "payroll_due"), false);
});

test("GET /notifications/due: conteos atrasados o de mañana para administración y bodega, nunca para caja", () => {
  const w = classifyDue("WAREHOUSE", [], [], dueOpts, extras).filter((i) => i.kind.startsWith("count_")).map((i) => `${i.kind}:${i.id}`);
  assert.deepEqual(w, ["count_overdue:5", "count_due:4"]);
  assert.equal(classifyDue("SALES", [], [], dueOpts, extras).some((i) => i.kind.startsWith("count_")), false);
  const summary = summarizeDue(classifyDue("ADMIN", [], [], dueOpts, extras));
  assert.match(summary, /2 pedidos por atender/);
  assert.match(summary, /1 nómina por pagar/);
  assert.match(summary, /2 conteos de inventario/);
});
