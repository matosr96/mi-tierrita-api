import { createValidator } from "../common/validate";

/**
 * Alarmas personalizadas (brief de octubre de 2026, punto 12): cada persona programa recordatorios con título, hora
 * local del negocio, repetición y el área del sistema a la que lleva el aviso.
 */
export const ALARM_REPEATS = ["ONCE", "DAILY", "WEEKDAYS", "WEEKLY"] as const;
export type AlarmRepeat = (typeof ALARM_REPEATS)[number];

/** Pantalla a la que lleva el aviso (mismas claves que `screen` de Tita, sin las de sistema). */
export const ALARM_AREAS = ["inicio", "inventario", "lotes", "ventas", "clientes", "proveedores", "finanzas", "reportes", "chat", "alarmas"] as const;
export type AlarmArea = (typeof ALARM_AREAS)[number];

export type AlarmRow = {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  /** HH:MM:SS tal como lo devuelve PostgreSQL (TIME). */
  timeOfDay: string;
  repeat: AlarmRepeat;
  weekdays: number[];
  date: string | null;
  area: AlarmArea | null;
  active: boolean;
  nextFireAt: Date | null;
  lastFiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AlarmResponse = {
  id: number;
  title: string;
  description: string | null;
  /** HH:MM en hora local del negocio. */
  timeOfDay: string;
  repeat: AlarmRepeat;
  weekdays: number[];
  date: string | null;
  area: AlarmArea | null;
  active: boolean;
  nextFireAt: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const toAlarmResponse = (row: AlarmRow): AlarmResponse => ({
  id: row.id,
  title: row.title,
  description: row.description,
  timeOfDay: row.timeOfDay.slice(0, 5),
  repeat: row.repeat,
  weekdays: row.weekdays,
  date: row.date,
  area: row.area,
  active: row.active,
  nextFireAt: row.nextFireAt === null ? null : row.nextFireAt.toISOString(),
  lastFiredAt: row.lastFiredAt === null ? null : row.lastFiredAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Un disparo pasado, con los datos de su alarma para listarlo sin otra consulta. */
export type AlarmFireRow = { id: number; alarmId: number; title: string; description: string | null; area: AlarmArea | null; firedAt: Date; seenAt: Date | null };

export type AlarmFireResponse = { id: number; alarmId: number; title: string; description: string | null; area: AlarmArea | null; firedAt: string; seenAt: string | null };

export const toAlarmFireResponse = (row: AlarmFireRow): AlarmFireResponse => ({
  id: row.id,
  alarmId: row.alarmId,
  title: row.title,
  description: row.description,
  area: row.area,
  firedAt: row.firedAt.toISOString(),
  seenAt: row.seenAt === null ? null : row.seenAt.toISOString(),
});

export type CreateAlarmRequest = {
  title: string;
  description: string | null;
  timeOfDay: string;
  repeat: AlarmRepeat;
  weekdays: number[];
  date: string | null;
  area: AlarmArea | null;
};

const TIME_RULE = { pattern: /^([01]\d|2[0-3]):[0-5]\d$/, patternMessage: "Formato esperado HH:MM (24 horas)" };

/** Reglas comunes a crear y editar: hora HH:MM, días solo para WEEKLY (sin repetir), fecha solo para ONCE. */
const readAlarmFields = (body: unknown) => {
  const v = createValidator(body);
  const title = v.string("title", { min: 1, max: 120 });
  const description = v.string("description", { max: 400 }, false);
  const timeOfDay = v.string("timeOfDay", TIME_RULE);
  const repeat = v.oneOf("repeat", ALARM_REPEATS);
  const weekdays = v.array("weekdays", { max: 7 }, (item) => item.number("value", { integer: true, min: 0, max: 6 }), false);
  const date = v.date("date", false);
  const area = v.oneOf("area", ALARM_AREAS, false);
  if (repeat === "WEEKLY" && !v.issues().some((i) => i.path.startsWith("weekdays"))) {
    if (weekdays === undefined || weekdays.length === 0) v.custom("weekdays", "Elija al menos un día de la semana");
    else if (new Set(weekdays).size !== weekdays.length) v.custom("weekdays", "No repita días");
  }
  if (repeat === "ONCE" && date === undefined && !v.issues().some((i) => i.path === "date")) v.custom("date", "Una alarma de una sola vez necesita fecha");
  v.done();
  return {
    title: title!,
    description: description === undefined || description === "" ? null : description,
    timeOfDay: timeOfDay!,
    repeat: repeat!,
    weekdays: repeat === "WEEKLY" ? [...(weekdays ?? [])].sort((a, b) => a - b) : [],
    date: repeat === "ONCE" ? date! : null,
    area: area ?? null,
  };
};

/**
 * `weekdays` llega como lista de enteros 0–6 (0 = domingo). El validador de listas trabaja con objetos, así que cada
 * número se envuelve antes de validarlo y se desenvuelve después.
 */
const wrapWeekdays = (body: unknown): unknown =>
  typeof body === "object" && body !== null && Array.isArray((body as { weekdays?: unknown }).weekdays)
    ? { ...(body as Record<string, unknown>), weekdays: ((body as { weekdays: unknown[] }).weekdays).map((value) => ({ value })) }
    : body;

export const parseCreateAlarm = (body: unknown): CreateAlarmRequest => readAlarmFields(wrapWeekdays(body));

export type UpdateAlarmRequest = CreateAlarmRequest;

/** Editar reemplaza la programación completa (la app envía el formulario entero). */
export const parseUpdateAlarm = (body: unknown): UpdateAlarmRequest => readAlarmFields(wrapWeekdays(body));

export type SetAlarmActiveRequest = { active: boolean };

export const parseSetAlarmActive = (body: unknown): SetAlarmActiveRequest => {
  const v = createValidator(body);
  const active = v.boolean("active");
  v.done();
  return { active: active! };
};

export type AlarmListStatus = "upcoming" | "past";

/** `?status=upcoming` (por defecto) lista las alarmas; `?status=past`, los disparos ocurridos. */
export const queryAlarmStatus = (raw: unknown): AlarmListStatus => (raw === "past" ? "past" : "upcoming");
