import { AUDIT_ENTITY_MAX, type AuditChanges } from "../../models/index";

/**
 * Qué registro tocó una escritura y qué cambió, a partir de la petición y la respuesta (brief de octubre de 2026,
 * punto 33). Función pura: la usa el middleware de auditoría y se prueba sin servidor.
 *
 * - `entity`: el primer segmento de la ruta después del prefijo (`/api/v1/products/12/batches` → `products`).
 * - `entityId`: el primer segmento numérico de la ruta; si no hay (una creación, `POST /products`), el `id` del
 *   cuerpo de la respuesta.
 * - `changes.request`: el cuerpo de la petición sin campos sensibles (contraseñas, `data` de adjuntos, base64 y
 *   cualquier texto de más de 2000 caracteres); `changes.response`: solo `id` y los campos escalares del primer
 *   nivel de la respuesta, nunca la respuesta completa.
 */
export type AuditDescription = { entity: string | null; entityId: number | null; changes: AuditChanges | null };

/** Campos que nunca se guardan en la bitácora, se llamen como se llamen dentro del cuerpo. */
const SENSITIVE_KEYS = new Set(["password", "currentpassword", "newpassword", "data", "token", "secret", "authorization"]);
/** Un texto más largo que esto no es un dato de negocio (es un documento o una foto). */
export const AUDIT_TEXT_MAX = 2000;
/** Una foto o un archivo embebido: data URI, o una cadena larga sin espacios de solo caracteres base64 con mayúsculas, minúsculas y dígitos mezclados. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]{120,}={0,2}$/;
const isBase64 = (value: string): boolean => value.startsWith("data:") || (BASE64_PATTERN.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value));
const MAX_DEPTH = 4;
const MAX_ARRAY = 50;
const SCALAR_TEXT_MAX = 200;
const PREFIX = /^\/api\/v\d+\//;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isScalar = (value: unknown): value is string | number | boolean | null => value === null || ["string", "number", "boolean"].includes(typeof value);

const cleanValue = (value: unknown, depth: number): unknown => {
  if (typeof value === "string") return value.length > AUDIT_TEXT_MAX || isBase64(value) ? undefined : value;
  if (isScalar(value)) return value;
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => cleanValue(v, depth + 1)).filter((v) => v !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (isPlainObject(value)) {
    const out = cleanObject(value, depth + 1);
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
};

const cleanObject = (body: Record<string, unknown>, depth: number): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    const value = cleanValue(raw, depth);
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/** El cuerpo de la petición tal como se guarda: sin campos sensibles ni textos largos. Vacío → undefined. */
export const cleanRequestBody = (body: unknown): Record<string, unknown> | undefined => {
  if (!isPlainObject(body)) return undefined;
  const out = cleanObject(body, 0);
  return Object.keys(out).length > 0 ? out : undefined;
};

/** Resumen de la respuesta: `id` y los campos escalares del primer nivel (textos acotados). */
export const summarizeResponse = (body: unknown): Record<string, unknown> | undefined => {
  if (!isPlainObject(body)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string") {
      if (value.length <= AUDIT_TEXT_MAX && !isBase64(value)) out[key] = value.length > SCALAR_TEXT_MAX ? `${value.slice(0, SCALAR_TEXT_MAX - 1)}…` : value;
    } else if (isScalar(value)) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const responseId = (body: unknown): number | null => {
  if (!isPlainObject(body)) return null;
  const id = body["id"];
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
};

export const describeAudit = (method: string, path: string, body: unknown, responseBody: unknown): AuditDescription => {
  const clean = (path.split("?")[0] ?? "").replace(PREFIX, "").replace(/^\/+/, "");
  const segments = clean.split("/").filter((s) => s !== "");
  const first = segments[0];
  const entity = first !== undefined && first.length <= AUDIT_ENTITY_MAX ? first.toLowerCase() : null;
  const numeric = segments.find((s) => /^\d+$/.test(s));
  const entityId = numeric !== undefined ? Number(numeric) : method.toUpperCase() === "POST" ? responseId(responseBody) : null;
  const request = cleanRequestBody(body);
  const response = summarizeResponse(responseBody);
  const changes: AuditChanges = {};
  if (request !== undefined) changes.request = request;
  if (response !== undefined) changes.response = response;
  return { entity, entityId: entity === null ? null : entityId, changes: Object.keys(changes).length > 0 ? changes : null };
};
