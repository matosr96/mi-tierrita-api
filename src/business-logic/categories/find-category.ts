import { db, type Queryable } from "../../data-sources/index";
import type { CategoryRow } from "../../models/index";

export const CATEGORY_COLUMNS = `id, name, code, description, tags, active, created_at AS "createdAt"`;

/** Orden de todo listado de categorías: primero las líneas de la página pública por código, luego las internas por nombre. */
export const CATEGORY_ORDER = `ORDER BY code NULLS LAST, name`;

export const findCategoryById = async (id: number, q: Queryable = db): Promise<CategoryRow | undefined> => {
  const { rows } = await q.query<CategoryRow>(`SELECT ${CATEGORY_COLUMNS} FROM categories WHERE id = $1`, [id]);
  return rows[0];
};
