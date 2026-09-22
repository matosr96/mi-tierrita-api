import type { Request, RequestHandler } from "express";
import { ErrorCodes, domainError } from "../common/index.js";
import { usersDataSource } from "../data-sources/index.js";
import { verifyAccessToken } from "./token.js";
import type { Role } from "./roles.js";

/** Identidad del usuario que hace la petición, disponible para todas las capas. */
export type AuthContext = {
  userId: number;
  username: string;
  role: Role;
};

const AUTH_KEY = Symbol("auth");

type AuthenticatedRequest = Request & { [AUTH_KEY]?: AuthContext };

/** Devuelve la identidad autenticada, o undefined en una ruta pública. */
export const getAuth = (req: Request): AuthContext | undefined =>
  (req as AuthenticatedRequest)[AUTH_KEY];

/** Identidad garantizada: solo se usa en rutas que ya pasaron por authenticate. */
export const requireAuth = (req: Request): AuthContext => {
  const auth = getAuth(req);
  if (auth === undefined) throw domainError(ErrorCodes.TOKEN_INVALID);
  return auth;
};

/**
 * Middleware de autenticación (documento 01, sección 5): identifica quién hace la
 * petición a partir del token Bearer y verifica contra la base que el usuario siga
 * activo y que el token no haya sido invalidado por un cierre de sesión.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header === undefined || !header.startsWith("Bearer ")) {
    throw domainError(ErrorCodes.TOKEN_INVALID);
  }
  const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw domainError(ErrorCodes.TOKEN_INVALID);

  const user = await usersDataSource.findById(userId);
  if (user === undefined || user.tokenVersion !== payload.tv) throw domainError(ErrorCodes.TOKEN_INVALID);
  if (!user.active) throw domainError(ErrorCodes.USER_INACTIVE);

  (req as AuthenticatedRequest)[AUTH_KEY] = { userId: user.id, username: user.username, role: user.role };
  next();
};
