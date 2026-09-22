import { ErrorCodes, domainError, toPageResponse, todayIso, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toProductBatchResponse, type ProductBatchResponse, type ProductBatchRow } from "../../models/index";
import { findProductById } from "../products/find-product";
import { BATCH_COLUMNS, BATCH_FROM } from "./batch-queries";

/** Lotes de un producto, ordenados por vencimiento (el orden FEFO). ?onlyAvailable=true omite los agotados. */
export const listProductBatches = async (
  productId: number,
  page: PageRequest,
  filter: { onlyAvailable?: boolean | undefined },
): Promise<PageResponse<ProductBatchResponse>> => {
  const product = await findProductById(productId);
  if (product === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
  const where = `WHERE b.product_id = $1 ${filter.onlyAvailable === true ? "AND b.quantity_remaining > 0" : ""}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${BATCH_FROM} ${where}`, [productId]),
    db.query<ProductBatchRow>(
      `SELECT ${BATCH_COLUMNS} ${BATCH_FROM} ${where} ORDER BY b.expires_at, b.id LIMIT $2 OFFSET $3`,
      [productId, page.limit, page.offset],
    ),
  ]);
  const today = todayIso();
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map((row) => toProductBatchResponse(row, today)));
};
