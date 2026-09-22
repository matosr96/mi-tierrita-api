import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseCreateBatch } from "../../models/index";
import { registerBatch } from "../../business-logic/batches/index";

/** POST /api/v1/products/:id/batches — ADMIN, WAREHOUSE (CU-06). */
export const registerBatchController: RequestHandler = async (req, res) => {
  const input = parseCreateBatch(req.body);
  res.status(201).json(await registerBatch({ productId: parseId(req.params["id"]), ...input }));
};
