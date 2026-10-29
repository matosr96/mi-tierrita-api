import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { cancelStockCount } from "../../business-logic/stock-counts/index";

/** POST /api/v1/stock-counts/:id/cancel — ADMIN, WAREHOUSE. Solo PLANNED o IN_PROGRESS. */
export const cancelStockCountController: RequestHandler = async (req, res) => {
  res.json(await cancelStockCount(parseId(req.params["id"]), requireAuth(req)));
};
