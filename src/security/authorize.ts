import type { RequestHandler } from "express";
import { ErrorCodes, domainError } from "../common/index";
import { requireAuth } from "./authenticate";
import type { Role } from "./roles";

/**
 * Matriz de autorización (documento 01, sección 5): decide qué rol puede usar cada
 * recurso. Un intento sin el rol requerido responde 403 con el código 613 y la lista
 * de roles requeridos, sin filtrar información de otros usuarios (RF-01.5).
 */
export const authorize = (...allowed: Role[]): RequestHandler => (req, _res, next) => {
  const auth = requireAuth(req);
  if (!allowed.includes(auth.role)) {
    throw domainError(ErrorCodes.ROLE_INSUFFICIENT, { requiredRoles: allowed });
  }
  next();
};
