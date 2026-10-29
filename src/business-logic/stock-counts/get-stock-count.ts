import { ErrorCodes, domainError, todayIso } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import { toStockCountResponse, type StockCountDetailResponse } from "../../models/index";
import { findStockCountById, findStockCountLines, summarizeLines } from "./stock-count-queries";

/** Conteo con sus líneas (producto, SKU, esperado, contado, diferencia) y el resumen calculado en el servidor. */
export const getStockCount = async (id: number, q: Queryable = db): Promise<StockCountDetailResponse> => {
  const row = await findStockCountById(id, q);
  if (row === undefined) throw domainError(ErrorCodes.STOCK_COUNT_NOT_FOUND);
  const lines = await findStockCountLines(id, q);
  return { ...toStockCountResponse(row, todayIso()), lines, summary: summarizeLines(lines) };
};
