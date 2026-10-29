import { ErrorCodes, domainError } from "../common/errors";

/**
 * Detalle de una escritura (brief de octubre de 2026, punto 33): `request` es el cuerpo de la petición sin campos
 * sensibles y `response` un resumen escalar de lo que respondió la API. Nunca la respuesta completa.
 */
export type AuditChanges = { request?: Record<string, unknown>; response?: Record<string, unknown> };

export type AuditRow = {
  id: number;
  userId: number;
  username: string;
  method: string;
  resource: string;
  aiSuggested: boolean;
  entity: string | null;
  entityId: number | null;
  changes: AuditChanges | null;
  createdAt: Date;
};

export type AuditResponse = Omit<AuditRow, "createdAt"> & { createdAt: string };

export const toAuditResponse = (row: AuditRow): AuditResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type NewAudit = {
  userId: number;
  method: string;
  resource: string;
  aiSuggested?: boolean;
  entity?: string | null;
  entityId?: number | null;
  changes?: AuditChanges | null;
};

export type AuditListFilter = { userId?: number | undefined; resource?: string | undefined; from?: string | undefined; to?: string | undefined };

export const AUDIT_ENTITY_MAX = 40;
const ENTITY_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Parámetro `:entity` de la línea de tiempo: un segmento de ruta en minúsculas (products, customers, sales…). */
export const parseAuditEntity = (raw: unknown): string => {
  if (typeof raw !== "string" || raw.length > AUDIT_ENTITY_MAX || !ENTITY_PATTERN.test(raw)) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "entity", message: "Debe ser el nombre de un recurso (products, customers, sales…)" }]);
  }
  return raw;
};
