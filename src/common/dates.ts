import { isIsoDate } from "./validate";

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

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
