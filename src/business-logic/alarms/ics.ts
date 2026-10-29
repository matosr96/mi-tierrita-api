import { BUSINESS_TIME_ZONE } from "../../common/index";
import type { AlarmResponse } from "../../models/index";
import { nextFireAt, zonedParts } from "./next-fire";

/**
 * Archivo iCalendar (RFC 5545) de una o varias alarmas, para agregarlas al calendario del teléfono (brief de octubre
 * de 2026, punto 14). Cada alarma es un VEVENT con RRULE según su repetición, en la zona del negocio, y un VALARM
 * que avisa a la hora exacta. Funciones puras: no tocan la base.
 */
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** Escapa texto según RFC 5545 (barra invertida, punto y coma, coma y saltos de línea). */
export const icsEscape = (text: string): string => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega líneas de más de 75 octetos (continuación con un espacio al inicio). */
export const icsFold = (line: string): string => {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(chunk);
      chunk = "";
      size = 0;
    }
    chunk += ch;
    size += n;
  }
  out.push(chunk);
  return out.join("\r\n ");
};

const pad = (n: number): string => String(n).padStart(2, "0");

const localStamp = (d: Date, timeZone: string): string => {
  const p = zonedParts(d, timeZone);
  return `${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`;
};

const utcStamp = (d: Date): string => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Regla de repetición de la alarma, o null para una de una sola vez. */
export const icsRrule = (alarm: Pick<AlarmResponse, "repeat" | "weekdays">): string | null => {
  switch (alarm.repeat) {
    case "ONCE":
      return null;
    case "DAILY":
      return "FREQ=DAILY";
    case "WEEKDAYS":
      return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "WEEKLY":
      return `FREQ=WEEKLY;BYDAY=${[...alarm.weekdays].sort((a, b) => a - b).map((d) => BYDAY[d] ?? "MO").join(",")}`;
  }
};

/**
 * Primer DTSTART del evento: el próximo disparo si lo hay; si no (alarma apagada o ya sonó), la hora de hoy o su
 * fecha. Así el calendario muestra la serie desde ahora.
 */
const firstStart = (alarm: AlarmResponse, now: Date, timeZone: string): string => {
  const next = nextFireAt({ timeOfDay: alarm.timeOfDay, repeat: alarm.repeat, weekdays: alarm.weekdays, date: alarm.date }, now, timeZone);
  if (next !== null) return localStamp(next, timeZone);
  const [h, m] = alarm.timeOfDay.split(":");
  if (alarm.date !== null) return `${alarm.date.replace(/-/g, "")}T${pad(Number(h))}${pad(Number(m))}00`;
  const p = zonedParts(now, timeZone);
  return `${p.year}${pad(p.month)}${pad(p.day)}T${pad(Number(h))}${pad(Number(m))}00`;
};

/** VEVENT de una alarma (líneas sin plegar). */
export const icsEvent = (alarm: AlarmResponse, now: Date, timeZone: string): string[] => {
  const rrule = icsRrule(alarm);
  const lines = [
    "BEGIN:VEVENT",
    `UID:alarma-${alarm.id}@mitierrita`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=${timeZone}:${firstStart(alarm, now, timeZone)}`,
    `DURATION:PT15M`,
    `SUMMARY:${icsEscape(alarm.title)}`,
  ];
  if (alarm.description !== null && alarm.description !== "") lines.push(`DESCRIPTION:${icsEscape(alarm.description)}`);
  if (rrule !== null) lines.push(`RRULE:${rrule}`);
  if (alarm.area !== null) lines.push(`CATEGORIES:${icsEscape(alarm.area)}`);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(alarm.title)}`, "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT");
  return lines;
};

/** VTIMEZONE de la zona del negocio: Colombia no cambia de hora (UTC-5 todo el año). */
const VTIMEZONE_BOGOTA = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Bogota",
  "BEGIN:STANDARD",
  "DTSTART:19930404T000000",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0500",
  "TZNAME:-05",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Calendario completo con una o varias alarmas. Devuelve el texto listo para servir como `text/calendar`. */
export const alarmsToIcs = (alarms: AlarmResponse[], now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): string => {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mi Tierrita SIG//Alarmas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Alarmas de Mi Tierrita"];
  if (timeZone === "America/Bogota") lines.push(...VTIMEZONE_BOGOTA);
  for (const alarm of alarms) lines.push(...icsEvent(alarm, now, timeZone));
  lines.push("END:VCALENDAR");
  return `${lines.map(icsFold).join("\r\n")}\r\n`;
};
