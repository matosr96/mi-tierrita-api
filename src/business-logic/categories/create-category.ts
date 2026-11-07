import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toCategoryResponse, type CategoryResponse, type CategoryRow, type CreateCategoryRequest } from "../../models/index";
import { CATEGORY_COLUMNS } from "./find-category";

/** Una categoría nueva nace interna (sin `code`): no sale en la página pública. */
export const createCategory = async (input: CreateCategoryRequest): Promise<CategoryResponse> => {
  try {
    const { rows } = await db.query<CategoryRow>(
      `INSERT INTO categories (name, description, tags) VALUES ($1, $2, $3::text[]) RETURNING ${CATEGORY_COLUMNS}`,
      [input.name, input.description ?? null, input.tags ?? []],
    );
    const row = rows[0];
    if (row === undefined) throw new Error("INSERT de categoría no devolvió fila");
    return toCategoryResponse(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
