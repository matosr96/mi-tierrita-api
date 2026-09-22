import { db, type Queryable } from "../../data-sources/index";
import type { UserRow } from "../../models/index";

export const USER_COLUMNS = `
  u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username,
  u.password_hash AS "passwordHash", r.name AS role, u.token_version AS "tokenVersion",
  u.active, u.created_at AS "createdAt"`;

export const USER_FROM = `FROM users u JOIN roles r ON r.id = u.role_id`;

export const findUserById = async (id: number, q: Queryable = db): Promise<UserRow | undefined> => {
  const { rows } = await q.query<UserRow>(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = $1`, [id]);
  return rows[0];
};

export const findUserByUsername = async (username: string, q: Queryable = db): Promise<UserRow | undefined> => {
  const { rows } = await q.query<UserRow>(
    `SELECT ${USER_COLUMNS} ${USER_FROM} WHERE lower(u.username) = lower($1)`,
    [username],
  );
  return rows[0];
};
