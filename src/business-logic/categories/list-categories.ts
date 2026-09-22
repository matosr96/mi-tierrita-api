import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index.js";
import { categoriesDataSource } from "../../data-sources/index.js";
import { toCategoryResponse, type CategoryResponse } from "../../models/index.js";

export const listCategories = async (
  page: PageRequest,
  filter: { active?: boolean },
): Promise<PageResponse<CategoryResponse>> => {
  const { count, rows } = await categoriesDataSource.list(page, filter);
  return toPageResponse(page, count, rows.map(toCategoryResponse));
};
