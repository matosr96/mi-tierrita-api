import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { submitStockCount } from "../../business-logic/stock-counts/index";

/** POST /api/v1/stock-counts/:id/submit — ADMIN, WAREHOUSE. Exige todas las líneas contadas (712 si no). */
export const submitStockCountController: RequestHandler = async (req, res) => {
  res.json(await submitStockCount(parseId(req.params["id"]), requireAuth(req)));
};
