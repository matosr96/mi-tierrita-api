import { ErrorCodes, domainError, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import type { StockCountDetailResponse, UpdateStockCountRequest } from "../../models/index";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/** Cambiar título, fecha o nota de un conteo todavía programado (PLANNED). */
export const updateStockCount = async (id: number, auth: StockCountActor, input: UpdateStockCountRequest): Promise<StockCountDetailResponse> => {
  if (input.scheduledDate !== undefined && input.scheduledDate < todayIso()) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "scheduledDate", message: "La fecha no puede ser anterior a hoy" }]);
  }
  await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "update", auth.role);
    await client.query(
      `UPDATE stock_counts
         SET title = COALESCE($2, title),
             scheduled_date = COALESCE($3, scheduled_date),
             note = CASE WHEN $4::boolean THEN $5 ELSE note END
       WHERE id = $1`,
      [id, input.title ?? null, input.scheduledDate ?? null, input.note !== undefined, input.note ?? null],
    );
  });
  return getStockCount(id);
};
