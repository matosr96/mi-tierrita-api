import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toCategoryResponse, type CategoryResponse, type CategoryRow } from "../../models/index";
import { CATEGORY_COLUMNS } from "./find-category";

export const listCategories = async (
  page: PageRequest,
  filter: { active?: boolean | undefined },
): Promise<PageResponse<CategoryResponse>> => {
  const where = filter.active === undefined ? "" : "WHERE active = $3";
  const params: unknown[] = [page.limit, page.offset];
  if (filter.active !== undefined) params.push(filter.active);
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM categories ${where}`, params.slice(2)),
    db.query<CategoryRow>(`SELECT ${CATEGORY_COLUMNS} FROM categories ${where} ORDER BY name LIMIT $1 OFFSET $2`, params),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toCategoryResponse));
};
