import { db } from "../../data-sources/index";

/** CU-02 Cerrar sesión: incrementa la versión de token, invalidando todas las sesiones. */
export const signout = async (userId: number): Promise<void> => {
  await db.query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [userId]);
};
