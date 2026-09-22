import { usersDataSource } from "../../data-sources/index.js";

/** CU-02 Cerrar sesión: incrementa la versión de token, invalidando todas las sesiones. */
export const signout = async (userId: number): Promise<void> => {
  await usersDataSource.bumpTokenVersion(userId);
};
