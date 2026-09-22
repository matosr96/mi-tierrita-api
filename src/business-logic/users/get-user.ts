import { ErrorCodes, domainError } from "../../common/index.js";
import { usersDataSource } from "../../data-sources/index.js";
import { toUserResponse, type UserResponse } from "../../models/index.js";

export const getUser = async (id: number): Promise<UserResponse> => {
  const user = await usersDataSource.findById(id);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
