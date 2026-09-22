import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { hashPassword, verifyPassword } from "../../security/index";
import type { ChangePasswordRequest } from "../../models/index";
import { findUserById } from "./find-user";

/** CU-04 Cambiar contraseña propia: verifica la actual y actualiza el hash. No invalida otras sesiones. */
export const changeOwnPassword = async (userId: number, input: ChangePasswordRequest): Promise<void> => {
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw domainError(ErrorCodes.INVALID_CREDENTIALS);
  await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, await hashPassword(input.newPassword)]);
};
