import { BUSINESS_TIME_ZONE, addDaysIso, todayIso } from "../../common/index";
import type { AlarmArea, AlarmRepeat, CalendarItem, CalendarPriority, CalendarResponse, CalendarStatus } from "../../models/index";
import { monthEndIso } from "../../models/calendar";
import type { Role } from "../../security/index";
import { nextFireAt } from "../alarms/next-fire";
import { DUE_SOON_DAYS, seesBatches, seesReceivables, type DueReceivable } from "../notifications/due-items";

/**
 * Armado puro del calendario (sin base de datos): a partir de los lotes, la cartera, las alarmas propias y sus
 * disparos, devuelve los ítems con fecha dentro de `[from, to]` que le corresponden a un rol, más el resumen.
 * - Lotes (ADMIN y WAREHOUSE): prioridad alta si vencen en 7 días o ya vencieron (estado `overdue`).
 * - Cobros (ADMIN y SALES): fecha en que la cartera cumple el plazo (`overdueDays` desde la última venta a crédito);
 *   vencida → alta y `overdue`; a 5 días → media; el resto baja.
 * - Alarmas propias: próximos disparos dentro del rango (iterando `nextFireAt`) y los ya ocurridos como `done`.
 * - Cierres de mes: último día de cada mes del rango; `done` si ya pasó.
 */
export const BATCH_HIGH_DAYS = 7;
export const BATCH_MEDIUM_DAYS = 30;

export const AREAS = { batch: "Lotes", receivable: "Cartera", alarm: "Alarmas", closing: "Cierres" } as const;

export type CalendarBatch = { id: number; productName: string; quantityRemaining: number; expiresAt: string };
export type CalendarAlarm = { id: number; title: string; area: AlarmArea | null; active: boolean; timeOfDay: string; repeat: AlarmRepeat; weekdays: number[]; date: string | null };
export type CalendarAlarmFire = { id: number; alarmId: number; title: string; firedAt: Date };

export type CalendarData = {
  /** Fecha local del negocio (YYYY-MM-DD) e instante actual. */
  today: string;
  now: Date;
  batches: CalendarBatch[];
  receivables: DueReceivable[];
  overdueDays: number;
  alarms: CalendarAlarm[];
  alarmFires: CalendarAlarmFire[];
};

const money = (n: number): string => `$ ${Math.round(n).toLocaleString("es-CO")}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
const inRange = (date: string, from: string, to: string): boolean => date >= from && date <= to;
const timeLabel = (hhmm: string): string => hhmm.slice(0, 5);

/** Un disparo por día como máximo en la respuesta (una alarma diaria no debería repetirse más de 62 veces). */
const MAX_FIRES_PER_ALARM = 70;

const batchItems = (batches: CalendarBatch[], from: string, to: string, today: string): CalendarItem[] =>
  batches
    .filter((b) => b.quantityRemaining > 0 && inRange(b.expiresAt, from, to))
    .map((b): CalendarItem => {
      const days = daysBetween(today, b.expiresAt);
      const expired = days < 0;
      const priority: CalendarPriority = expired || days <= BATCH_HIGH_DAYS ? "alta" : days <= BATCH_MEDIUM_DAYS ? "media" : "baja";
      const units = plural(b.quantityRemaining, "unidad", "unidades");
      return {
        id: `batch-${b.id}`,
        kind: "batch",
        title: `Lote #${b.id} de ${b.productName}`,
        detail: expired ? `Venció hace ${plural(-days, "día", "días")} · ${units} en bodega` : days === 0 ? `Vence hoy · ${units}` : `Vence en ${plural(days, "día", "días")} · ${units}`,
        date: b.expiresAt,
        priority,
        area: AREAS.batch,
        status: expired ? "overdue" : "pending",
        href: "/lotes",
      };
    });

const receivableItems = (receivables: DueReceivable[], overdueDays: number, from: string, to: string, today: string): CalendarItem[] => {
  const items: CalendarItem[] = [];
  for (const r of receivables) {
    if (r.balance <= 0 || r.lastCreditSaleAt === null) continue;
    const dueOn = addDaysIso(r.lastCreditSaleAt.slice(0, 10), overdueDays);
    if (!inRange(dueOn, from, to)) continue;
    const overdue = r.overdue || dueOn < today;
    const days = daysBetween(today, dueOn);
    items.push({
      id: `receivable-${r.customerId}`,
      kind: "receivable",
      title: overdue ? `Cobrar a ${r.name} (vencido)` : `Cobrar a ${r.name}`,
      detail: overdue ? `Debe ${money(r.balance)} · plazo de ${overdueDays} días cumplido` : `Debe ${money(r.balance)} · el plazo de ${overdueDays} días se cumple ${days === 0 ? "hoy" : `en ${plural(days, "día", "días")}`}`,
      date: dueOn,
      priority: overdue ? "alta" : days <= DUE_SOON_DAYS ? "media" : "baja",
      area: AREAS.receivable,
      status: overdue ? "overdue" : "pending",
      href: `/clientes?c=${r.customerId}`,
    });
  }
  return items;
};

const alarmItems = (alarms: CalendarAlarm[], fires: CalendarAlarmFire[], now: Date, from: string, to: string): CalendarItem[] => {
  const items: CalendarItem[] = [];
  for (const f of fires) {
    const date = todayIso(f.firedAt);
    if (!inRange(date, from, to)) continue;
    items.push({ id: `alarm-${f.alarmId}-fire-${f.id}`, kind: "alarm", title: f.title, detail: `Sonó a las ${timeLabel(todayTime(f.firedAt))}`, date, priority: "media", area: AREAS.alarm, status: "done", href: "/alarmas" });
  }
  for (const a of alarms) {
    if (!a.active) continue;
    let cursor = now;
    for (let i = 0; i < MAX_FIRES_PER_ALARM; i++) {
      const fire = nextFireAt(a, cursor);
      if (fire === null) break;
      const date = todayIso(fire);
      if (date > to) break;
      if (date >= from) items.push({ id: `alarm-${a.id}-${date}`, kind: "alarm", title: a.title, detail: `Suena a las ${timeLabel(a.timeOfDay)}${a.repeat === "ONCE" ? "" : " · se repite"}`, date, priority: "media", area: AREAS.alarm, status: "pending", href: "/alarmas" });
      cursor = fire;
    }
  }
  return items;
};

/** HH:MM del instante en la hora del negocio. */
const todayTime = (d: Date): string => new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

const closingItems = (from: string, to: string, today: string): CalendarItem[] => {
  const items: CalendarItem[] = [];
  let cursor = from;
  while (cursor <= to) {
    const end = monthEndIso(cursor);
    if (inRange(end, from, to)) {
      const label = new Date(`${end}T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
      const done = end < today;
      items.push({ id: `closing-${end.slice(0, 7)}`, kind: "closing", title: `Cierre de ${label}`, detail: done ? "Mes cerrado · revise el reporte de ventas" : end === today ? "Hoy termina el mes · corte de ventas y cartera" : "Corte mensual de ventas y cartera", date: end, priority: "media", area: AREAS.closing, status: done ? "done" : "pending", href: "/reportes" });
    }
    cursor = addDaysIso(end, 1);
  }
  return items;
};

const STATUS_ORDER: Record<CalendarStatus, number> = { overdue: 0, pending: 1, done: 2 };
const PRIORITY_ORDER: Record<CalendarPriority, number> = { alta: 0, media: 1, baja: 2 };

export const buildCalendar = (role: Role, from: string, to: string, data: CalendarData): CalendarResponse => {
  const items: CalendarItem[] = [
    ...(seesBatches(role) ? batchItems(data.batches, from, to, data.today) : []),
    ...(seesReceivables(role) ? receivableItems(data.receivables, data.overdueDays, from, to, data.today) : []),
    ...alarmItems(data.alarms, data.alarmFires, data.now, from, to),
    ...closingItems(from, to, data.today),
  ].sort((a, b) => a.date.localeCompare(b.date) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title));
  const summary = { pending: 0, overdue: 0, done: 0 };
  for (const i of items) summary[i.status]++;
  return { from, to, items, summary };
};
