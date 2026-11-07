import { db } from "../../data-sources/index";
import { toPublicCategoryResponse, type CategoryRow, type PublicCategoryResponse } from "../../models/index";

/**
 * Líneas de la página pública: categorías activas con código, en el orden del catálogo (01…06).
 * Es lo único de categorías que se sirve sin sesión; no lleva ids ni fechas.
 */
export const listPublicCategories = async (): Promise<{ items: PublicCategoryResponse[] }> => {
  const { rows } = await db.query<Pick<CategoryRow, "code" | "name" | "description" | "tags">>(
    `SELECT code, name, description, tags FROM categories WHERE active AND code IS NOT NULL ORDER BY code`,
  );
  return { items: rows.map(toPublicCategoryResponse) };
};
