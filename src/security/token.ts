import jwt from "jsonwebtoken";
import { config } from "../server/config.js";
import { ErrorCodes, domainError } from "../common/index.js";
import type { Role } from "./roles.js";

/**
 * Sesión sin estado en el servidor: el token lleva el id del usuario, su rol y la
 * versión de token. Cerrar sesión incrementa la versión en la base (CU-02), con lo
 * que todos los tokens emitidos antes quedan inválidos sin esperar a que expiren.
 */
export type AccessTokenPayload = {
  sub: string;
  role: Role;
  tv: number;
};

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: jwt.SignOptions = {
    subject: payload.sub,
    expiresIn: config.jwt.expiresIn as NonNullable<jwt.SignOptions["expiresIn"]>,
    algorithm: "HS256",
  };
  return jwt.sign({ role: payload.role, tv: payload.tv }, config.jwt.secret, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || decoded === null) throw domainError(ErrorCodes.TOKEN_INVALID);
    const { sub, role, tv } = decoded as { sub?: unknown; role?: unknown; tv?: unknown };
    if (typeof sub !== "string" || typeof role !== "string" || typeof tv !== "number") {
      throw domainError(ErrorCodes.TOKEN_INVALID);
    }
    return { sub, role: role as Role, tv };
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      throw domainError(ErrorCodes.TOKEN_INVALID);
    }
    throw err;
  }
};
