import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toSaleResponse, type SaleListFilter, type SaleResponse, type SaleRow } from "../../models/index";
import { SALE_COLUMNS, SALE_FROM } from "./sale-queries";

/** CU-10 / RF-03.5: listado con filtros por fecha (inclusive), cliente, usuario y estado. */
export const listSales = async (page: PageRequest, filter: SaleListFilter): Promise<PageResponse<SaleResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.from !== undefined) {
    params.push(filter.from);
    conditions.push(`s.created_at >= $${params.length}::date`);
  }
  if (filter.to !== undefined) {
    params.push(filter.to);
    conditions.push(`s.created_at < ($${params.length}::date + interval '1 day')`);
  }
  if (filter.customerId !== undefined) {
    params.push(filter.customerId);
    conditions.push(`s.customer_id = $${params.length}`);
  }
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    conditions.push(`s.user_id = $${params.length}`);
  }
  if (filter.status !== undefined) {
    params.push(filter.status);
    conditions.push(`s.status = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${SALE_FROM} ${where}`, params),
    db.query<SaleRow>(
      `SELECT ${SALE_COLUMNS} ${SALE_FROM} ${where} ORDER BY s.created_at DESC, s.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toSaleResponse));
};
