import type { RequestHandler } from "express";
import { parseId, parsePageRequest, queryBoolean } from "../../common/index";
import { listProductBatches } from "../../business-logic/batches/index";

/** GET /api/v1/products/:id/batches — autenticado. ?onlyAvailable=true omite lotes agotados. */
export const listProductBatchesController: RequestHandler = async (req, res) => {
  res.json(await listProductBatches(parseId(req.params["id"]), parsePageRequest(req.query), { onlyAvailable: queryBoolean(req.query["onlyAvailable"]) }));
};
