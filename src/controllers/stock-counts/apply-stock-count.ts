import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseApplyStockCount } from "../../models/index";
import { requireAuth } from "../../security/index";
import { applyStockCount } from "../../business-logic/stock-counts/index";

/** POST /api/v1/stock-counts/:id/apply — ADMIN. Cuerpo `{ surplusLots: [{ productId, expiresAt }] }`. */
export const applyStockCountController: RequestHandler = async (req, res) => {
  res.json(await applyStockCount(parseId(req.params["id"]), requireAuth(req), parseApplyStockCount(req.body)));
};
