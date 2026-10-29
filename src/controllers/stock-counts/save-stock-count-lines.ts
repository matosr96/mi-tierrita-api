import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseSaveStockCountLines } from "../../models/index";
import { requireAuth } from "../../security/index";
import { saveStockCountLines } from "../../business-logic/stock-counts/index";

/** PUT /api/v1/stock-counts/:id/lines — ADMIN, WAREHOUSE. Guarda lo contado (a medias o completo); solo IN_PROGRESS. */
export const saveStockCountLinesController: RequestHandler = async (req, res) => {
  res.json(await saveStockCountLines(parseId(req.params["id"]), requireAuth(req), parseSaveStockCountLines(req.body)));
};
