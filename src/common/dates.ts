import { isIsoDate } from "./validate";

/**
 * Zona horaria del negocio (la tienda está en Córdoba, Colombia). "Hoy", el corte de los reportes y el
 * vencimiento de los lotes se cuentan en hora local, no en UTC: una venta de las 8 p. m. es del mismo día.
 * La sesión de PostgreSQL usa la misma zona (ver data-sources/db.ts) para que `::date` coincida.
 */
export const BUSINESS_TIME_ZONE = process.env["BUSINESS_TZ"]?.trim() || "America/Bogota";

const isoFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Fecha YYYY-MM-DD en la zona del negocio (por defecto, la de este instante). */
export const todayIso = (now: Date = new Date()): string => isoFormatter.format(now);

export const addDaysIso = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Lee un parámetro de query como fecha YYYY-MM-DD o devuelve el valor por defecto. */
export const queryDate = (raw: unknown, fallback: string): string => (isIsoDate(raw) ? raw : fallback);

/** Lee un entero positivo de la query o devuelve el valor por defecto. */
export const queryInt = (raw: unknown, fallback: number, max = 3650): number => {
  if (typeof raw !== "string") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
};
