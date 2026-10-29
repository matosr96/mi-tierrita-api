import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateStockCount } from "../../models/index";
import { requireAuth } from "../../security/index";
import { updateStockCount } from "../../business-logic/stock-counts/index";

/** PUT /api/v1/stock-counts/:id — ADMIN, WAREHOUSE. Título, fecha y nota; solo PLANNED. */
export const updateStockCountController: RequestHandler = async (req, res) => {
  res.json(await updateStockCount(parseId(req.params["id"]), requireAuth(req), parseUpdateStockCount(req.body)));
};
