import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toProductResponse, type ProductListFilter, type ProductResponse, type ProductRow } from "../../models/index";
import { PRODUCT_COLUMNS, PRODUCT_FROM } from "./find-product";

/** RF-02.1 / RF-02.3: listado con stock actual, filtrable por categoría, estado y texto. */
export const listProducts = async (page: PageRequest, filter: ProductListFilter): Promise<PageResponse<ProductResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.categoryId !== undefined) {
    params.push(filter.categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (filter.active !== undefined) {
    params.push(filter.active);
    conditions.push(`p.active = $${params.length}`);
  }
  if (filter.search !== undefined && filter.search !== "") {
    params.push(`%${filter.search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${PRODUCT_FROM} ${where}`, params),
    db.query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} ${where} ORDER BY p.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toProductResponse));
};
