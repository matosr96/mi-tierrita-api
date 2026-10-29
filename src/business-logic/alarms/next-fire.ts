import { BUSINESS_TIME_ZONE } from "../../common/index";
import type { AlarmRepeat } from "../../models/index";

/**
 * Cálculo del próximo disparo de una alarma en la zona del negocio (America/Bogota). Función pura: recibe la
 * programación y el instante actual y devuelve el instante del siguiente disparo, o null si ya no habrá otro
 * (una alarma ONCE cuya fecha y hora ya pasaron). Usa `Intl.DateTimeFormat`, como `common/dates.ts`, para no
 * depender de la zona del servidor.
 */
export type AlarmSchedule = { timeOfDay: string; repeat: AlarmRepeat; weekdays: number[]; date: string | null };

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });

/** Descompone un instante en fecha, hora y día de la semana de la zona dada. */
export const zonedParts = (date: Date, timeZone: string = BUSINESS_TIME_ZONE): Parts => {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out["year"]),
    month: Number(out["month"]),
    day: Number(out["day"]),
    hour: Number(out["hour"]) % 24,
    minute: Number(out["minute"]),
    second: Number(out["second"]),
    weekday: WEEKDAY_INDEX[out["weekday"] ?? "Sun"] ?? 0,
  };
};

/**
 * Instante que corresponde a una hora de pared (año, mes, día, hora, minuto) en la zona dada. Parte de la misma
 * hora en UTC y corrige con el desfase que la zona tiene en ese instante (dos pasadas cubren un cambio de horario).
 */
export const zonedDate = (year: number, month: number, day: number, hour: number, minute: number, timeZone: string = BUSINESS_TIME_ZONE): Date => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
    guess += Date.UTC(year, month - 1, day, hour, minute, 0, 0) - asUtc;
  }
  return new Date(guess);
};

const parseTime = (timeOfDay: string): { hour: number; minute: number } => {
  const [h, m] = timeOfDay.split(":");
  return { hour: Number(h), minute: Number(m) };
};

const parseIsoDate = (iso: string): { year: number; month: number; day: number } => {
  const [y, m, d] = iso.split("-");
  return { year: Number(y), month: Number(m), day: Number(d) };
};

/** Suma días a una fecha de calendario (sin zona: solo aritmética de calendario). */
const addDays = (d: { year: number; month: number; day: number }, days: number) => {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), weekday: t.getUTCDay() };
};

const fitsRepeat = (repeat: AlarmRepeat, weekdays: number[], weekday: number): boolean =>
  repeat === "DAILY" || (repeat === "WEEKDAYS" ? weekday >= 1 && weekday <= 5 : repeat === "WEEKLY" ? weekdays.includes(weekday) : false);

/** Próximo disparo estrictamente posterior a `now`, o null si la alarma no volverá a sonar. */
export const nextFireAt = (alarm: AlarmSchedule, now: Date, timeZone: string = BUSINESS_TIME_ZONE): Date | null => {
  const { hour, minute } = parseTime(alarm.timeOfDay);
  if (alarm.repeat === "ONCE") {
    if (alarm.date === null) return null;
    const d = parseIsoDate(alarm.date);
    const at = zonedDate(d.year, d.month, d.day, hour, minute, timeZone);
    return at.getTime() > now.getTime() ? at : null;
  }
  if (alarm.repeat === "WEEKLY" && alarm.weekdays.length === 0) return null;
  const today = zonedParts(now, timeZone);
  // Como mucho una semana por delante: en 8 días siempre cae alguno de los días elegidos.
  for (let offset = 0; offset <= 8; offset++) {
    const day = addDays(today, offset);
    if (!fitsRepeat(alarm.repeat, alarm.weekdays, day.weekday)) continue;
    const at = zonedDate(day.year, day.month, day.day, hour, minute, timeZone);
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
};

/** Tras un disparo, una alarma de una sola vez se apaga; las demás siguen activas. */
export const staysActiveAfterFire = (repeat: AlarmRepeat): boolean => repeat !== "ONCE";
