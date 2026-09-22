import bcrypt from "bcryptjs";
import { config } from "../server/config";

/** Contraseñas con bcrypt (RNF-02): nunca se guardan ni se devuelven en texto plano. */
export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, config.bcryptRounds);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
