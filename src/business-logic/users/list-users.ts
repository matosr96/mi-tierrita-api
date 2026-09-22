import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toUserResponse, type UserResponse, type UserRow } from "../../models/index";
import { USER_COLUMNS, USER_FROM } from "./find-user";

export const listUsers = async (page: PageRequest): Promise<PageResponse<UserResponse>> => {
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM users`),
    db.query<UserRow>(`SELECT ${USER_COLUMNS} ${USER_FROM} ORDER BY u.id LIMIT $1 OFFSET $2`, [page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toUserResponse));
};
