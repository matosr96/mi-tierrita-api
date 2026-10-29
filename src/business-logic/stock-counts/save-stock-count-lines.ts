import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { SaveStockCountLinesRequest, StockCountDetailResponse } from "../../models/index";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/**
 * Registrar lo contado (solo IN_PROGRESS); se puede guardar a medias. Devuelve el conteo completo con la diferencia
 * de cada línea calculada en la base. Un producto que no está en el conteo responde 400 en su posición de la lista.
 */
export const saveStockCountLines = async (id: number, auth: StockCountActor, input: SaveStockCountLinesRequest): Promise<StockCountDetailResponse> => {
  await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "saveLines", auth.role);
    const issues: { path: string; message: string }[] = [];
    for (const [index, line] of input.lines.entries()) {
      const { rowCount } = await client.query(
        `UPDATE stock_count_lines
           SET counted_quantity = $3,
               note = CASE WHEN $4::boolean THEN $5 ELSE note END
         WHERE count_id = $1 AND product_id = $2`,
        [id, line.productId, line.countedQuantity, line.note !== undefined, line.note ?? null],
      );
      if ((rowCount ?? 0) === 0) issues.push({ path: `lines[${index}].productId`, message: "El producto no está en este conteo" });
    }
    if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  });
  return getStockCount(id);
};
