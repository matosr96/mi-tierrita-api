import { ErrorCodes, domainError } from "../../common/index.js";
import { usersDataSource } from "../../data-sources/index.js";
import { toUserResponse, type UserResponse } from "../../models/index.js";

/** Datos básicos del usuario autenticado. */
export const me = async (userId: number): Promise<UserResponse> => {
  const user = await usersDataSource.findById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
