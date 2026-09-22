import type { RequestHandler } from "express";
import { parsePageRequest, queryInt } from "../../common/index";
import { listExpiringBatches } from "../../business-logic/batches/index";

/** GET /api/v1/batches/expiring?days=30 — ADMIN, WAREHOUSE (CU-07). */
export const listExpiringBatchesController: RequestHandler = async (req, res) => {
  res.json(await listExpiringBatches(parsePageRequest(req.query), queryInt(req.query["days"], 30)));
};
