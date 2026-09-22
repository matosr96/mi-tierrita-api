import { db, type Queryable } from "./db.js";
import type { CategoryRow } from "../models/index.js";
import type { PageRequest } from "../common/index.js";

const COLUMNS = `id, name, active, created_at AS "createdAt"`;

export const categoriesDataSource = {
  findById: async (id: number, q: Queryable = db): Promise<CategoryRow | undefined> => {
    const { rows } = await q.query<CategoryRow>(`SELECT ${COLUMNS} FROM categories WHERE id = $1`, [id]);
    return rows[0];
  },

  list: async (
    page: PageRequest,
    filter: { active?: boolean },
    q: Queryable = db,
  ): Promise<{ count: number; rows: CategoryRow[] }> => {
    const where = filter.active === undefined ? "" : "WHERE active = $3";
    const params: unknown[] = [page.limit, page.offset];
    if (filter.active !== undefined) params.push(filter.active);
    const [{ rows: countRows }, { rows }] = await Promise.all([
      q.query<{ count: number }>(`SELECT count(*)::int AS count FROM categories ${where}`, params.slice(2)),
      q.query<CategoryRow>(`SELECT ${COLUMNS} FROM categories ${where} ORDER BY name LIMIT $1 OFFSET $2`, params),
    ]);
    return { count: countRows[0]?.count ?? 0, rows };
  },

  insert: async (name: string, q: Queryable = db): Promise<CategoryRow> => {
    const { rows } = await q.query<CategoryRow>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING ${COLUMNS}`,
      [name],
    );
    const row = rows[0];
    if (row === undefined) throw new Error("INSERT de categoría no devolvió fila");
    return row;
  },

  update: async (
    id: number,
    changes: { name?: string | undefined; active?: boolean | undefined },
    q: Queryable = db,
  ): Promise<CategoryRow | undefined> => {
    const { rows } = await q.query<CategoryRow>(
      `UPDATE categories
         SET name = COALESCE($2, name), active = COALESCE($3, active)
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, changes.name ?? null, changes.active ?? null],
    );
    return rows[0];
  },

  /** Borrado físico; falla con FK si hay productos asociados (se traduce a 631). */
  remove: async (id: number, q: Queryable = db): Promise<boolean> => {
    const { rowCount } = await q.query(`DELETE FROM categories WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  },
};
