import { db, type Queryable } from "./db.js";
import type { UserRow } from "../models/index.js";
import type { PageRequest } from "../common/index.js";
import type { Role } from "../security/roles.js";

const COLUMNS = `
  u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username,
  u.password_hash AS "passwordHash", r.name AS role, u.token_version AS "tokenVersion",
  u.active, u.created_at AS "createdAt"`;

const FROM = `FROM users u JOIN roles r ON r.id = u.role_id`;

export type NewUserRow = {
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
};

export const usersDataSource = {
  findById: async (id: number, q: Queryable = db): Promise<UserRow | undefined> => {
    const { rows } = await q.query<UserRow>(`SELECT ${COLUMNS} ${FROM} WHERE u.id = $1`, [id]);
    return rows[0];
  },

  findByUsername: async (username: string, q: Queryable = db): Promise<UserRow | undefined> => {
    const { rows } = await q.query<UserRow>(
      `SELECT ${COLUMNS} ${FROM} WHERE lower(u.username) = lower($1)`,
      [username],
    );
    return rows[0];
  },

  list: async (page: PageRequest, q: Queryable = db): Promise<{ count: number; rows: UserRow[] }> => {
    const [{ rows: countRows }, { rows }] = await Promise.all([
      q.query<{ count: number }>(`SELECT count(*)::int AS count FROM users`),
      q.query<UserRow>(`SELECT ${COLUMNS} ${FROM} ORDER BY u.id LIMIT $1 OFFSET $2`, [page.limit, page.offset]),
    ]);
    return { count: countRows[0]?.count ?? 0, rows };
  },

  insert: async (user: NewUserRow, q: Queryable = db): Promise<UserRow> => {
    const { rows } = await q.query<{ id: number }>(
      `INSERT INTO users (first_name, last_name, username, password_hash, role_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5))
       RETURNING id`,
      [user.firstName, user.lastName, user.username, user.passwordHash, user.role],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("INSERT de usuario no devolvió id");
    const created = await usersDataSource.findById(id, q);
    if (created === undefined) throw new Error("Usuario recién creado no encontrado");
    return created;
  },

  updatePasswordHash: async (id: number, passwordHash: string, q: Queryable = db): Promise<void> => {
    await q.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
  },

  /** Invalida todos los tokens vigentes del usuario (CU-02). */
  bumpTokenVersion: async (id: number, q: Queryable = db): Promise<void> => {
    await q.query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [id]);
  },
};
