import { ErrorCodes, domainError } from "../../common/index";
import { toUserResponse, type UserResponse } from "../../models/index";
import { findUserById } from "../users/find-user";

/** Datos básicos del usuario autenticado. */
export const me = async (userId: number): Promise<UserResponse> => {
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
