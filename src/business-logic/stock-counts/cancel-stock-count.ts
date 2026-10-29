import { db } from "../../data-sources/index";
import type { StockCountDetailResponse } from "../../models/index";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/** Cancelar un conteo programado o en curso. Las líneas se conservan como registro; no se mueve stock. */
export const cancelStockCount = async (id: number, auth: StockCountActor): Promise<StockCountDetailResponse> => {
  await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "cancel", auth.role);
    await client.query(`UPDATE stock_counts SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2 WHERE id = $1`, [id, auth.userId]);
  });
  return getStockCount(id);
};
