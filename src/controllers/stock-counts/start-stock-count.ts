import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { startStockCount } from "../../business-logic/stock-counts/index";

/** POST /api/v1/stock-counts/:id/start — ADMIN, WAREHOUSE. Crea las líneas con la foto del stock físico. */
export const startStockCountController: RequestHandler = async (req, res) => {
  res.json(await startStockCount(parseId(req.params["id"]), requireAuth(req)));
};
