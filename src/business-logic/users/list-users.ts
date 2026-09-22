import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index.js";
import { usersDataSource } from "../../data-sources/index.js";
import { toUserResponse, type UserResponse } from "../../models/index.js";

export const listUsers = async (page: PageRequest): Promise<PageResponse<UserResponse>> => {
  const { count, rows } = await usersDataSource.list(page);
  return toPageResponse(page, count, rows.map(toUserResponse));
};
