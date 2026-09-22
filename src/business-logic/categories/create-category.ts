import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toCategoryResponse, type CategoryResponse, type CategoryRow, type CreateCategoryRequest } from "../../models/index";
import { CATEGORY_COLUMNS } from "./find-category";

export const createCategory = async (input: CreateCategoryRequest): Promise<CategoryResponse> => {
  try {
    const { rows } = await db.query<CategoryRow>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING ${CATEGORY_COLUMNS}`,
      [input.name],
    );
    const row = rows[0];
    if (row === undefined) throw new Error("INSERT de categoría no devolvió fila");
    return toCategoryResponse(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
