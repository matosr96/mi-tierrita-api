import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { StockCountDetailResponse } from "../../models/index";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/**
 * Iniciar (PLANNED → IN_PROGRESS): crea una línea por cada producto activo del alcance con la foto de su stock
 * físico de este momento (`expected_quantity`). Un alcance sin productos activos responde 400.
 */
export const startStockCount = async (id: number, auth: StockCountActor): Promise<StockCountDetailResponse> => {
  await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "start", auth.role);
    const { rowCount } = await client.query(
      `INSERT INTO stock_count_lines (count_id, product_id, expected_quantity)
       SELECT $1, p.id, p.stock FROM products p
       WHERE p.active AND ($2::bigint IS NULL OR p.category_id = $2)
       ORDER BY p.id`,
      [id, count.categoryId],
    );
    if ((rowCount ?? 0) === 0) {
      throw domainError(ErrorCodes.VALIDATION, [{ path: "scope", message: "El alcance no tiene productos activos para contar" }]);
    }
    await client.query(`UPDATE stock_counts SET status = 'IN_PROGRESS', started_at = now(), started_by = $2 WHERE id = $1`, [id, auth.userId]);
  });
  return getStockCount(id);
};
