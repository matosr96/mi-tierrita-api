import { db, type Queryable } from "../../data-sources/index";
import type { CategoryRow } from "../../models/index";

export const CATEGORY_COLUMNS = `id, name, active, created_at AS "createdAt"`;

export const findCategoryById = async (id: number, q: Queryable = db): Promise<CategoryRow | undefined> => {
  const { rows } = await q.query<CategoryRow>(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = $1`, [id]);
  return rows[0];
};
