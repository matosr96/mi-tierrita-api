import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toCategoryResponse, type CategoryResponse, type CategoryRow, type UpdateCategoryRequest } from "../../models/index";
import { CATEGORY_COLUMNS } from "./find-category";

export const updateCategory = async (id: number, input: UpdateCategoryRequest): Promise<CategoryResponse> => {
  try {
    const { rows } = await db.query<CategoryRow>(
      `UPDATE categories
         SET name = COALESCE($2, name), active = COALESCE($3, active)
       WHERE id = $1
       RETURNING ${CATEGORY_COLUMNS}`,
      [id, input.name ?? null, input.active ?? null],
    );
    const updated = rows[0];
    if (updated === undefined) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
    return toCategoryResponse(updated);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
