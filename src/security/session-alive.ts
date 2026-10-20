import { findUserById } from "../business-logic/users/find-user";
import { verifyAccessToken } from "./token";

/**
 * ¿Sigue vigente la sesión de este token? Lo usan las conexiones largas (avisos en vivo del chat), que solo pasan por
 * `authenticate` al abrirse: si el token venció, la persona cerró sesión o la desactivaron, la conexión se corta.
 */
export const isSessionAlive = async (token: string): Promise<boolean> => {
  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(Number(payload.sub));
    return user !== undefined && user.active && user.tokenVersion === payload.tv;
  } catch {
    return false;
  }
};
