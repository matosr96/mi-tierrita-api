import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getStockCount } from "../../business-logic/stock-counts/index";

/** GET /api/v1/stock-counts/:id — ADMIN, WAREHOUSE. Conteo con sus líneas y resumen. */
export const getStockCountController: RequestHandler = async (req, res) => {
  res.json(await getStockCount(parseId(req.params["id"])));
};
