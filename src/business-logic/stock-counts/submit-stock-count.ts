import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { StockCountDetailResponse } from "../../models/index";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/** Enviar (IN_PROGRESS → SUBMITTED): exige que todas las líneas tengan cantidad contada; si no, 712 con cuáles faltan. */
export const submitStockCount = async (id: number, auth: StockCountActor): Promise<StockCountDetailResponse> => {
  await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "submit", auth.role);
    const { rows } = await client.query<{ productId: number }>(
      `SELECT product_id AS "productId" FROM stock_count_lines WHERE count_id = $1 AND counted_quantity IS NULL ORDER BY product_id`,
      [id],
    );
    if (rows.length > 0) {
      throw domainError(ErrorCodes.STOCK_COUNT_LINES_PENDING, { pending: rows.length, productIds: rows.slice(0, 50).map((r) => r.productId) });
    }
    await client.query(`UPDATE stock_counts SET status = 'SUBMITTED', submitted_at = now(), submitted_by = $2 WHERE id = $1`, [id, auth.userId]);
  });
  return getStockCount(id);
};
