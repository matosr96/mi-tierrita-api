import { ErrorCodes, domainError } from "../../common/index";
import { ALL_ORDER_KINDS, OrderKinds, type OrderKind } from "../../models/index";
import { Roles, type Role } from "../../security/roles";

/**
 * Qué tipo de pedido maneja cada rol (función pura): los pedidos a proveedor son de ADMIN y bodega; los de cliente,
 * de ADMIN y secretaria. Un rol solo lista, crea, edita, recibe, entrega o cancela los pedidos de sus tipos.
 */
export const ORDER_KIND_ROLES: Readonly<Record<OrderKind, readonly Role[]>> = {
  [OrderKinds.SUPPLIER]: [Roles.ADMIN, Roles.WAREHOUSE],
  [OrderKinds.CUSTOMER]: [Roles.ADMIN, Roles.SALES],
};

export const kindsForRole = (role: Role): OrderKind[] => ALL_ORDER_KINDS.filter((kind) => ORDER_KIND_ROLES[kind].includes(role));

export const canUseKind = (role: Role, kind: OrderKind): boolean => ORDER_KIND_ROLES[kind].includes(role);

/** 613 con `requiredRoles` (el mismo cuerpo que `authorize`) si el rol no maneja ese tipo de pedido. */
export const assertKindAllowed = (role: Role, kind: OrderKind): void => {
  if (!canUseKind(role, kind)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT, { requiredRoles: ORDER_KIND_ROLES[kind] });
};

/** Tipos que lista `GET /orders`: los del rol, o solo el pedido si el rol lo maneja (si no, 613). */
export const listKindsFor = (role: Role, requested?: OrderKind): OrderKind[] => {
  if (requested === undefined) return kindsForRole(role);
  assertKindAllowed(role, requested);
  return [requested];
};
