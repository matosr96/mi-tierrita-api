import { toPageResponse, todayIso, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toStockCountResponse, type StockCountListFilter, type StockCountResponse, type StockCountRow } from "../../models/index";
import { STOCK_COUNT_COLUMNS, STOCK_COUNT_FROM } from "./stock-count-queries";

/**
 * Listado con filtros por estado y por fecha programada (inclusive). Primero los abiertos (en curso, enviados,
 * programados) del más próximo al más lejano; después los cerrados, del más reciente al más antiguo.
 */
export const listStockCounts = async (page: PageRequest, filter: StockCountListFilter): Promise<PageResponse<StockCountResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status !== undefined) {
    params.push(filter.status);
    conditions.push(`sc.status = $${params.length}`);
  }
  if (filter.from !== undefined) {
    params.push(filter.from);
    conditions.push(`sc.scheduled_date >= $${params.length}::date`);
  }
  if (filter.to !== undefined) {
    params.push(filter.to);
    conditions.push(`sc.scheduled_date <= $${params.length}::date`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = `
    CASE sc.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'SUBMITTED' THEN 1 WHEN 'PLANNED' THEN 2 ELSE 3 END,
    CASE WHEN sc.status IN ('IN_PROGRESS', 'SUBMITTED', 'PLANNED') THEN sc.scheduled_date END ASC,
    sc.scheduled_date DESC, sc.id DESC`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM stock_counts sc ${where}`, params),
    db.query<StockCountRow>(
      `SELECT ${STOCK_COUNT_COLUMNS} ${STOCK_COUNT_FROM} ${where} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  const today = todayIso();
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map((r) => toStockCountResponse(r, today)));
};
