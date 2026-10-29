import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { previewAdjustment } from "../../business-logic/stock-counts/index";

/** GET /api/v1/stock-counts/:id/preview-adjustment — ADMIN, WAREHOUSE. Ajuste contra el stock actual, sin escribir. */
export const previewAdjustmentController: RequestHandler = async (req, res) => {
  res.json(await previewAdjustment(parseId(req.params["id"])));
};
