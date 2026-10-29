import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseCreateAlarm, parseSetAlarmActive, queryAlarmStatus, type AlarmResponse } from "../src/models/alarms";
import { nextFireAt, staysActiveAfterFire, zonedDate, zonedParts } from "../src/business-logic/alarms/next-fire";
import { alarmsToIcs, icsEscape, icsFold, icsRrule } from "../src/business-logic/alarms/ics";
import { toClient } from "../src/business-logic/chat/realtime";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

// 29/10/2026 es jueves; 08:00 de Bogotá = 13:00Z.
const THU_0800 = new Date("2026-10-29T13:00:00Z");
const FRI_0800 = new Date("2026-10-30T13:00:00Z");

test("parseCreateAlarm: hora HH:MM, repetición, días y área", () => {
  const a = parseCreateAlarm({ title: "Cierre de caja", timeOfDay: "17:30", repeat: "WEEKLY", weekdays: [5, 1], area: "ventas", description: "" });
  assert.equal(a.title, "Cierre de caja");
  assert.equal(a.timeOfDay, "17:30");
  assert.deepEqual(a.weekdays, [1, 5]);
  assert.equal(a.area, "ventas");
  assert.equal(a.description, null);
  assert.equal(a.date, null);
  // DAILY ignora días y fecha que vengan de más
  const d = parseCreateAlarm({ title: "Lotes", timeOfDay: "07:30", repeat: "DAILY", weekdays: [1], date: "2026-11-01" });
  assert.deepEqual(d.weekdays, []);
  assert.equal(d.date, null);
  assert.equal(d.area, null);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "7:30", repeat: "DAILY" })), ["timeOfDay"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "25:00", repeat: "DAILY" })), ["timeOfDay"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "08:00", repeat: "WEEKLY" })), ["weekdays"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "08:00", repeat: "WEEKLY", weekdays: [1, 1] })), ["weekdays"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "08:00", repeat: "WEEKLY", weekdays: [7] })), ["weekdays[0].value"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "08:00", repeat: "ONCE" })), ["date"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ title: "x", timeOfDay: "08:00", repeat: "DAILY", area: "usuarios" })), ["area"]);
  assert.deepEqual(paths400(() => parseCreateAlarm({ timeOfDay: "08:00", repeat: "MONTHLY" })), ["title", "repeat"]);
  assert.equal(parseSetAlarmActive({ active: false }).active, false);
  assert.deepEqual(paths400(() => parseSetAlarmActive({ active: "no" })), ["active"]);
  assert.equal(queryAlarmStatus("past"), "past");
  assert.equal(queryAlarmStatus(undefined), "upcoming");
});

test("zonedParts y zonedDate van y vuelven en la zona de Bogotá", () => {
  const p = zonedParts(THU_0800, "America/Bogota");
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute, p.weekday], [2026, 10, 29, 8, 0, 4]);
  assert.equal(zonedDate(2026, 10, 29, 8, 0, "America/Bogota").toISOString(), THU_0800.toISOString());
});

test("nextFireAt DAILY: hoy si la hora no ha pasado, mañana si ya pasó", () => {
  const daily = (t: string) => ({ timeOfDay: t, repeat: "DAILY" as const, weekdays: [], date: null });
  assert.equal(nextFireAt(daily("09:00"), THU_0800)?.toISOString(), "2026-10-29T14:00:00.000Z");
  assert.equal(nextFireAt(daily("07:00"), THU_0800)?.toISOString(), "2026-10-30T12:00:00.000Z");
  // Justo a la hora cuenta como pasada: el siguiente disparo es mañana.
  assert.equal(nextFireAt(daily("08:00"), THU_0800)?.toISOString(), "2026-10-30T13:00:00.000Z");
});

test("nextFireAt WEEKDAYS: el viernes después de la hora salta al lunes", () => {
  const a = { timeOfDay: "07:00", repeat: "WEEKDAYS" as const, weekdays: [], date: null };
  assert.equal(nextFireAt(a, FRI_0800)?.toISOString(), "2026-11-02T12:00:00.000Z");
  // Sábado 31/10 a las 10:00 → lunes
  assert.equal(nextFireAt(a, new Date("2026-10-31T15:00:00Z"))?.toISOString(), "2026-11-02T12:00:00.000Z");
});

test("nextFireAt WEEKLY con varios días elige el más próximo y luego el siguiente", () => {
  const a = { timeOfDay: "07:00", repeat: "WEEKLY" as const, weekdays: [2, 5], date: null };
  assert.equal(nextFireAt(a, THU_0800)?.toISOString(), "2026-10-30T12:00:00.000Z");
  assert.equal(nextFireAt(a, FRI_0800)?.toISOString(), "2026-11-03T12:00:00.000Z");
  assert.equal(nextFireAt({ ...a, weekdays: [] }, THU_0800), null);
});

test("nextFireAt ONCE: futuro → instante exacto; pasado → null y la alarma se apaga", () => {
  const once = (date: string) => ({ timeOfDay: "07:00", repeat: "ONCE" as const, weekdays: [], date });
  assert.equal(nextFireAt(once("2026-10-30"), THU_0800)?.toISOString(), "2026-10-30T12:00:00.000Z");
  assert.equal(nextFireAt(once("2026-10-29"), THU_0800), null);
  assert.equal(nextFireAt({ ...once("2026-10-30"), date: null }, THU_0800), null);
  assert.equal(staysActiveAfterFire("ONCE"), false);
  assert.equal(staysActiveAfterFire("DAILY"), true);
});

test("nextFireAt respeta el cambio de día en Bogotá, no en UTC", () => {
  // 30/10 04:30Z = jueves 29/10 23:30 en Bogotá.
  const lateNight = new Date("2026-10-30T04:30:00Z");
  const daily = (t: string) => ({ timeOfDay: t, repeat: "DAILY" as const, weekdays: [], date: null });
  assert.equal(nextFireAt(daily("23:45"), lateNight)?.toISOString(), "2026-10-30T04:45:00.000Z");
  assert.equal(nextFireAt(daily("08:00"), lateNight)?.toISOString(), "2026-10-30T13:00:00.000Z");
  // Una ONCE del 29 a las 23:45 todavía no ha pasado a las 23:30 locales.
  assert.equal(nextFireAt({ timeOfDay: "23:45", repeat: "ONCE", weekdays: [], date: "2026-10-29" }, lateNight)?.toISOString(), "2026-10-30T04:45:00.000Z");
});

const alarm = (over: Partial<AlarmResponse> = {}): AlarmResponse => ({
  id: 7,
  title: "Cierre de caja; sumar, cuadrar",
  description: "Línea 1\nLínea 2",
  timeOfDay: "17:30",
  repeat: "DAILY",
  weekdays: [],
  date: null,
  area: "ventas",
  active: true,
  nextFireAt: null,
  lastFiredAt: null,
  createdAt: THU_0800.toISOString(),
  updatedAt: THU_0800.toISOString(),
  ...over,
});

test("ics: RRULE según la repetición", () => {
  assert.equal(icsRrule({ repeat: "ONCE", weekdays: [] }), null);
  assert.equal(icsRrule({ repeat: "DAILY", weekdays: [] }), "FREQ=DAILY");
  assert.equal(icsRrule({ repeat: "WEEKDAYS", weekdays: [] }), "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  assert.equal(icsRrule({ repeat: "WEEKLY", weekdays: [5, 0, 2] }), "FREQ=WEEKLY;BYDAY=SU,TU,FR");
});

test("ics: escapes, zona, VALARM y plegado de líneas largas", () => {
  assert.equal(icsEscape("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
  const ics = alarmsToIcs([alarm()], THU_0800);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /TZID:America\/Bogota/);
  assert.match(ics, /UID:alarma-7@mitierrita/);
  assert.match(ics, /DTSTART;TZID=America\/Bogota:20261029T173000/);
  assert.match(ics, /SUMMARY:Cierre de caja\\; sumar\\, cuadrar/);
  assert.match(ics, /DESCRIPTION:Línea 1\\nLínea 2/);
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  // Una de una sola vez ya pasada conserva su fecha y no lleva RRULE
  const once = alarmsToIcs([alarm({ id: 8, repeat: "ONCE", date: "2026-10-20", timeOfDay: "07:00" })], THU_0800);
  assert.match(once, /DTSTART;TZID=America\/Bogota:20261020T070000/);
  assert.doesNotMatch(once, /RRULE/);
  // Plegado: ninguna línea supera 75 octetos
  const long = alarmsToIcs([alarm({ description: "x".repeat(200) })], THU_0800);
  for (const line of long.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, line);
  assert.equal(icsFold("corta"), "corta");
});

test("evento en vivo `alarm`: solo a su dueño y con los datos para el aviso", () => {
  const event = { kind: "alarm" as const, audience: [3], alarmId: 7, title: "Cierre de caja", description: null, area: "ventas", firedAt: THU_0800.toISOString() };
  assert.deepEqual(toClient(event, 3), { type: "alarm", alarmId: 7, title: "Cierre de caja", description: null, area: "ventas", firedAt: THU_0800.toISOString() });
});
