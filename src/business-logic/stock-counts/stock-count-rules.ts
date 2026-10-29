import { ErrorCodes, domainError } from "../../common/index";
import { StockCountStatuses, type StockCountStatus } from "../../models/index";
import { Roles, type Role } from "../../security/roles";

export type StockCountAction = "update" | "start" | "saveLines" | "submit" | "apply" | "cancel";

/**
 * Máquina de estados del conteo: desde qué estados se permite cada acción y qué roles pueden hacerla.
 * ADMIN y WAREHOUSE programan, inician, registran, envían y cancelan; solo ADMIN aplica el ajuste de existencias.
 */
const RULES: Record<StockCountAction, { from: readonly StockCountStatus[]; roles: readonly Role[] }> = {
  update: { from: [StockCountStatuses.PLANNED], roles: [Roles.ADMIN, Roles.WAREHOUSE] },
  start: { from: [StockCountStatuses.PLANNED], roles: [Roles.ADMIN, Roles.WAREHOUSE] },
  saveLines: { from: [StockCountStatuses.IN_PROGRESS], roles: [Roles.ADMIN, Roles.WAREHOUSE] },
  submit: { from: [StockCountStatuses.IN_PROGRESS], roles: [Roles.ADMIN, Roles.WAREHOUSE] },
  apply: { from: [StockCountStatuses.SUBMITTED], roles: [Roles.ADMIN] },
  cancel: { from: [StockCountStatuses.PLANNED, StockCountStatuses.IN_PROGRESS], roles: [Roles.ADMIN, Roles.WAREHOUSE] },
};

/** true si el rol puede hacer la acción sobre un conteo en ese estado. */
export const canTransition = (status: StockCountStatus, action: StockCountAction, role: Role): boolean =>
  RULES[action].from.includes(status) && RULES[action].roles.includes(role);

/** Lanza 613 si el rol no puede hacer la acción nunca, o 711 si el estado actual no la permite. */
export const assertTransition = (status: StockCountStatus, action: StockCountAction, role: Role): void => {
  const rule = RULES[action];
  if (!rule.roles.includes(role)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT, { requiredRoles: rule.roles });
  if (!rule.from.includes(status)) throw domainError(ErrorCodes.STOCK_COUNT_TRANSITION_INVALID, { status, action, allowedFrom: rule.from });
};

/** Diferencia de una línea: contado − esperado (negativa = faltante, positiva = sobrante); null si aún no se contó. */
export const countDifference = (expected: number, counted: number | null): number | null =>
  counted === null ? null : counted - expected;

/** Quién hace la acción (lo arma el controlador con `requireAuth`). */
export type StockCountActor = { userId: number; role: Role };
