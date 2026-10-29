import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { StockCountStatuses, type AdjustmentPreviewResponse } from "../../models/index";
import { buildAdjustmentPlan, toPreviewResponse } from "./adjustment-plan";

/**
 * Vista previa del ajuste de un conteo enviado: faltantes (con los lotes de los que saldrían, vencidos primero) y
 * sobrantes (que exigirán la fecha de vencimiento del lote de ajuste) contra el stock físico actual. No escribe nada.
 */
export const previewAdjustment = async (id: number): Promise<AdjustmentPreviewResponse> => {
  const { rows } = await db.query<{ status: AdjustmentPreviewResponse["status"] }>(`SELECT status FROM stock_counts WHERE id = $1`, [id]);
  const count = rows[0];
  if (count === undefined) throw domainError(ErrorCodes.STOCK_COUNT_NOT_FOUND);
  if (count.status !== StockCountStatuses.SUBMITTED) {
    throw domainError(ErrorCodes.STOCK_COUNT_TRANSITION_INVALID, { status: count.status, action: "preview", allowedFrom: [StockCountStatuses.SUBMITTED] });
  }
  return toPreviewResponse(id, count.status, await buildAdjustmentPlan(id, db, false));
};
