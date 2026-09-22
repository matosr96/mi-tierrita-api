import { ErrorCodes, domainError } from "../../common/index";
import { toUserResponse, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

export const getUser = async (id: number): Promise<UserResponse> => {
  const user = await findUserById(id);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
