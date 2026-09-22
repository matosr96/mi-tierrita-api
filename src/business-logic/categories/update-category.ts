import { ErrorCodes, domainError } from "../../common/index.js";
import { categoriesDataSource, isUniqueViolation } from "../../data-sources/index.js";
import { toCategoryResponse, type CategoryResponse, type UpdateCategoryRequest } from "../../models/index.js";

export const updateCategory = async (id: number, input: UpdateCategoryRequest): Promise<CategoryResponse> => {
  try {
    const updated = await categoriesDataSource.update(id, input);
    if (updated === undefined) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
    return toCategoryResponse(updated);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
