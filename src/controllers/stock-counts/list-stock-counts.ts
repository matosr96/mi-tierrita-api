import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { parseStockCountListFilter } from "../../models/index";
import { listStockCounts } from "../../business-logic/stock-counts/index";

/** GET /api/v1/stock-counts — ADMIN, WAREHOUSE. Filtros: ?status=, ?from=, ?to= (fecha programada, inclusive). */
export const listStockCountsController: RequestHandler = async (req, res) => {
  res.json(await listStockCounts(parsePageRequest(req.query), parseStockCountListFilter(req.query)));
};
