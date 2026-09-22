import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toCategoryResponse, type CategoryResponse, type CategoryRow } from "../../models/index";
import { CATEGORY_COLUMNS } from "./find-category";

export const listCategories = async (
  page: PageRequest,
  filter: { active?: boolean | undefined },
): Promise<PageResponse<CategoryResponse>> => {
  // El filtro es el parámetro $1 en ambas consultas; límite y offset van después
  const filterParams: unknown[] = filter.active === undefined ? [] : [filter.active];
  const where = filter.active === undefined ? "" : "WHERE active = $1";
  const params: unknown[] = [...filterParams, page.limit, page.offset];
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM categories ${where}`, filterParams),
    db.query<CategoryRow>(`SELECT ${CATEGORY_COLUMNS} FROM categories ${where} ORDER BY name LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`, params),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toCategoryResponse));
};
