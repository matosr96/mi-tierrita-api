import type { RequestHandler } from "express";
import { parseCreateStockCount } from "../../models/index";
import { requireAuth } from "../../security/index";
import { createStockCount } from "../../business-logic/stock-counts/index";

/** POST /api/v1/stock-counts — ADMIN, WAREHOUSE. Programa un conteo (PLANNED). */
export const createStockCountController: RequestHandler = async (req, res) => {
  res.status(201).json(await createStockCount(requireAuth(req).userId, parseCreateStockCount(req.body)));
};
