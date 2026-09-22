import { addDaysIso, toPageResponse, todayIso, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toProductBatchResponse, type ProductBatchResponse, type ProductBatchRow } from "../../models/index";
import { BATCH_COLUMNS, BATCH_FROM } from "./batch-queries";

/**
 * CU-07 / RF-02.5: lotes con existencias cuya fecha de vencimiento cae dentro de la ventana
 * (por defecto 30 días), incluidos los ya vencidos, ordenados por vencimiento ascendente.
 */
export const listExpiringBatches = async (page: PageRequest, days: number): Promise<PageResponse<ProductBatchResponse>> => {
  const today = todayIso();
  const limitDate = addDaysIso(today, days);
  const where = `WHERE b.quantity_remaining > 0 AND b.expires_at <= $1`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${BATCH_FROM} ${where}`, [limitDate]),
    db.query<ProductBatchRow>(
      `SELECT ${BATCH_COLUMNS} ${BATCH_FROM} ${where} ORDER BY b.expires_at, b.id LIMIT $2 OFFSET $3`,
      [limitDate, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map((row) => toProductBatchResponse(row, today)));
};
