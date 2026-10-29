import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendar, type CalendarData } from "../src/business-logic/calendar/build-calendar";
import { CALENDAR_MAX_DAYS, monthEndIso, parseCalendarRange } from "../src/models/calendar";
import { DomainError } from "../src/common/errors";

// Jueves 29 de octubre de 2026, 10:00 hora de Bogotá (15:00 UTC).
const now = new Date("2026-10-29T15:00:00.000Z");
const data: CalendarData = {
  today: "2026-10-29",
  now,
  overdueDays: 30,
  batches: [
    { id: 1, productName: "Concentrado", quantityRemaining: 4, expiresAt: "2026-10-27" },
    { id: 2, productName: "Vitaminas", quantityRemaining: 10, expiresAt: "2026-11-03" },
    { id: 3, productName: "Sal", quantityRemaining: 0, expiresAt: "2026-11-05" },
    { id: 4, productName: "Melaza", quantityRemaining: 2, expiresAt: "2026-11-20" },
    { id: 5, productName: "Lejano", quantityRemaining: 9, expiresAt: "2027-01-10" },
  ],
  receivables: [
    { customerId: 10, name: "Finca La Esperanza", balance: 250_000, lastCreditSaleAt: "2026-09-20T15:00:00.000Z", overdue: true },
    { customerId: 11, name: "Don Pedro", balance: 80_000, lastCreditSaleAt: "2026-10-02T15:00:00.000Z", overdue: false },
    { customerId: 12, name: "Reciente", balance: 50_000, lastCreditSaleAt: "2026-10-25T15:00:00.000Z", overdue: false },
    { customerId: 13, name: "Sin crédito", balance: 10_000, lastCreditSaleAt: null, overdue: false },
  ],
  alarms: [
    { id: 7, title: "Pedir concentrado", area: "inventario", active: true, timeOfDay: "08:00:00", repeat: "WEEKLY", weekdays: [1], date: null },
    { id: 8, title: "Una sola vez", area: null, active: true, timeOfDay: "16:30:00", repeat: "ONCE", weekdays: [], date: "2026-11-02" },
    { id: 9, title: "Apagada", area: null, active: false, timeOfDay: "09:00:00", repeat: "DAILY", weekdays: [], date: null },
  ],
  alarmFires: [{ id: 100, alarmId: 7, title: "Pedir concentrado", firedAt: new Date("2026-10-26T13:00:00.000Z") }],
};
const from = "2026-10-01";
const to = "2026-11-30";

test("buildCalendar: el administrador ve lotes, cobros, alarmas y cierres ordenados por fecha", () => {
  const cal = buildCalendar("ADMIN", from, to, data);
  const ids = cal.items.map((i) => i.id);
  // Lote 3 sin existencias y lote 5 fuera del rango no aparecen.
  assert.ok(ids.includes("batch-1") && ids.includes("batch-2") && ids.includes("batch-4"));
  assert.ok(!ids.includes("batch-3") && !ids.includes("batch-5"));
  // Cartera: vencida el 20/10 (venta 20/09 + 30), por vencer el 01/11; la reciente (24/11) también entra en el rango.
  assert.ok(ids.includes("receivable-10") && ids.includes("receivable-11") && ids.includes("receivable-12"));
  assert.ok(!ids.includes("receivable-13"));
  // Dos cierres: 31/10 (pendiente) y 30/11 (pendiente).
  assert.deepEqual(ids.filter((i) => i.startsWith("closing-")), ["closing-2026-10", "closing-2026-11"]);
  const dates = cal.items.map((i) => i.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("buildCalendar: prioridades y vencidos de lotes y cobros", () => {
  const cal = buildCalendar("ADMIN", from, to, data);
  const by = (id: string) => cal.items.find((i) => i.id === id)!;
  assert.equal(by("batch-1").status, "overdue");
  assert.equal(by("batch-1").priority, "alta");
  assert.match(by("batch-1").detail, /hace 2 días/);
  assert.equal(by("batch-2").status, "pending");
  assert.equal(by("batch-2").priority, "alta"); // vence en 5 días
  assert.equal(by("batch-4").priority, "media"); // 22 días
  assert.equal(by("receivable-10").status, "overdue");
  assert.equal(by("receivable-10").priority, "alta");
  assert.equal(by("receivable-10").date, "2026-10-20");
  assert.equal(by("receivable-10").href, "/clientes?c=10");
  assert.equal(by("receivable-11").date, "2026-11-01");
  assert.equal(by("receivable-11").priority, "media"); // a 3 días
  assert.equal(by("receivable-12").priority, "baja");
  assert.equal(by("batch-2").href, "/lotes");
  assert.equal(by("batch-1").area, "Lotes");
  assert.equal(by("receivable-11").area, "Cartera");
});

test("buildCalendar: alarmas propias dentro del rango y disparos ocurridos como cerrados", () => {
  const cal = buildCalendar("WAREHOUSE", from, to, data);
  const alarms = cal.items.filter((i) => i.kind === "alarm");
  const fired = alarms.find((i) => i.id === "alarm-7-fire-100")!;
  assert.equal(fired.status, "done");
  assert.equal(fired.date, "2026-10-26");
  // Semanal los lunes a partir de hoy (jueves 29/10): 2, 9, 16, 23 y 30 de noviembre.
  const weekly = alarms.filter((i) => i.id.startsWith("alarm-7-") && i.status === "pending").map((i) => i.date);
  assert.deepEqual(weekly, ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  const once = alarms.find((i) => i.id === "alarm-8-2026-11-02")!;
  assert.equal(once.detail, "Suena a las 16:30");
  assert.ok(!alarms.some((i) => i.id.startsWith("alarm-9-")));
});

test("buildCalendar: bodega no ve cobros y secretaría no ve lotes", () => {
  const w = buildCalendar("WAREHOUSE", from, to, data);
  assert.ok(w.items.some((i) => i.kind === "batch"));
  assert.ok(!w.items.some((i) => i.kind === "receivable"));
  const s = buildCalendar("SALES", from, to, data);
  assert.ok(!s.items.some((i) => i.kind === "batch"));
  assert.ok(s.items.some((i) => i.kind === "receivable"));
  // Las alarmas y los cierres los ven todos.
  assert.ok(s.items.some((i) => i.kind === "alarm") && s.items.some((i) => i.kind === "closing"));
});

test("buildCalendar: cierres de mes cerrados si ya pasaron y resumen coherente", () => {
  const cal = buildCalendar("ADMIN", "2026-09-01", "2026-10-31", data);
  const sept = cal.items.find((i) => i.id === "closing-2026-09")!;
  const oct = cal.items.find((i) => i.id === "closing-2026-10")!;
  assert.equal(sept.status, "done");
  assert.equal(oct.status, "pending");
  assert.equal(sept.href, "/reportes");
  const counts = { pending: 0, overdue: 0, done: 0 };
  for (const i of cal.items) counts[i.status]++;
  assert.deepEqual(cal.summary, counts);
  assert.ok(cal.summary.overdue >= 2); // lote 1 y cartera 10
});

test("parseCalendarRange: por defecto el mes en curso; más de 62 días o fechas al revés → 400", () => {
  assert.deepEqual(parseCalendarRange({}, "2026-10-29"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(parseCalendarRange({ from: "2026-10-05" }, "2026-10-29"), { from: "2026-10-05", to: "2026-10-31" });
  assert.equal(monthEndIso("2026-02-10"), "2026-02-28");
  assert.deepEqual(parseCalendarRange({ from: "2026-10-01", to: "2026-12-01" }, "2026-10-29"), { from: "2026-10-01", to: "2026-12-01" }); // 62 días justos
  assert.equal(CALENDAR_MAX_DAYS, 62);
  try {
    parseCalendarRange({ from: "2026-10-01", to: "2026-12-02" }, "2026-10-29");
    assert.fail("debió fallar");
  } catch (err) {
    assert.ok(err instanceof DomainError);
    assert.equal(err.code, "400");
    assert.equal(err.status, 400);
  }
  assert.throws(() => parseCalendarRange({ from: "2026-10-10", to: "2026-10-01" }, "2026-10-29"), (e: unknown) => e instanceof DomainError && e.status === 400);
  assert.throws(() => parseCalendarRange({ from: "ayer" }, "2026-10-29"), (e: unknown) => e instanceof DomainError && e.code === "400");
});
