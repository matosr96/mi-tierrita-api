import { ErrorCodes, domainError } from "../../common/index.js";
import { usersDataSource } from "../../data-sources/index.js";
import { hashPassword, verifyPassword } from "../../security/index.js";
import type { ChangePasswordRequest } from "../../models/index.js";

/** CU-04 Cambiar contraseña propia: verifica la actual y actualiza el hash. No invalida otras sesiones. */
export const changeOwnPassword = async (userId: number, input: ChangePasswordRequest): Promise<void> => {
  const user = await usersDataSource.findById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw domainError(ErrorCodes.INVALID_CREDENTIALS);
  await usersDataSource.updatePasswordHash(userId, await hashPassword(input.newPassword));
};
