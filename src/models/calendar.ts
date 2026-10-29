import { ErrorCodes, domainError } from "../common/errors";
import { isIsoDate } from "../common/validate";

/**
 * Calendario reutilizable (brief de octubre de 2026, punto 31): un solo listado con fecha por rol. Lotes por vencer y
 * vencidos (ADMIN y WAREHOUSE), cobros de cartera (ADMIN y SALES), pedidos abiertos (a proveedor: ADMIN y WAREHOUSE;
 * de cliente: ADMIN y SALES), pagos de nómina sin hacer (ADMIN), conteos de inventario pendientes (ADMIN y WAREHOUSE),
 * alarmas propias y cierres de mes.
 */
export const CALENDAR_KINDS = ["batch", "receivable", "alarm", "closing", "order", "payroll", "count"] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const CALENDAR_PRIORITIES = ["alta", "media", "baja"] as const;
export type CalendarPriority = (typeof CALENDAR_PRIORITIES)[number];

export const CALENDAR_STATUSES = ["pending", "overdue", "done"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export type CalendarItem = {
  /** Único dentro de la respuesta: `<kind>-<id>[-<fecha>]`. */
  id: string;
  kind: CalendarKind;
  title: string;
  detail: string;
  /** Fecha del ítem (YYYY-MM-DD, hora del negocio). */
  date: string;
  priority: CalendarPriority;
  /** Área del sistema, en texto (Lotes, Cartera, Pedidos, Nómina, Conteos, Alarmas, Cierres). */
  area: string;
  status: CalendarStatus;
  /** Pantalla de la app a la que lleva. */
  href: string;
};

export type CalendarSummary = { pending: number; overdue: number; done: number };
export type CalendarResponse = { from: string; to: string; items: CalendarItem[]; summary: CalendarSummary };

/** Ventana máxima de una consulta (dos meses). */
export const CALENDAR_MAX_DAYS = 62;

export type CalendarRange = { from: string; to: string };

const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

/** Último día del mes de una fecha YYYY-MM-DD. */
export const monthEndIso = (iso: string): string => {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0));
  return last.toISOString().slice(0, 10);
};

/**
 * `from` y `to` de la query (por defecto, el mes en curso). Fechas YYYY-MM-DD, `from` ≤ `to` y como mucho 62 días:
 * si no, 400 con el detalle del campo.
 */
export const parseCalendarRange = (query: Record<string, unknown>, today: string): CalendarRange => {
  const issues: { path: string; message: string }[] = [];
  const rawFrom = query["from"];
  const rawTo = query["to"];
  if (rawFrom !== undefined && !isIsoDate(rawFrom)) issues.push({ path: "from", message: "Debe ser una fecha YYYY-MM-DD" });
  if (rawTo !== undefined && !isIsoDate(rawTo)) issues.push({ path: "to", message: "Debe ser una fecha YYYY-MM-DD" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  const from = isIsoDate(rawFrom) ? rawFrom : `${today.slice(0, 7)}-01`;
  const to = isIsoDate(rawTo) ? rawTo : monthEndIso(from);
  const span = daysBetween(from, to);
  if (span < 0) issues.push({ path: "to", message: "Debe ser igual o posterior a la fecha inicial" });
  else if (span + 1 > CALENDAR_MAX_DAYS) issues.push({ path: "to", message: `El rango no puede superar ${CALENDAR_MAX_DAYS} días` });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  return { from, to };
};
