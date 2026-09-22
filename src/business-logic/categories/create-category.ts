import { ErrorCodes, domainError } from "../../common/index.js";
import { categoriesDataSource, isUniqueViolation } from "../../data-sources/index.js";
import { toCategoryResponse, type CategoryResponse, type CreateCategoryRequest } from "../../models/index.js";

export const createCategory = async (input: CreateCategoryRequest): Promise<CategoryResponse> => {
  try {
    return toCategoryResponse(await categoriesDataSource.insert(input.name));
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
