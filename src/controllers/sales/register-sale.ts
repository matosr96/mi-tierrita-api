import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateSale } from "../../models/index";
import { registerSale } from "../../business-logic/sales/index";

/** POST /api/v1/sales — ADMIN, SALES (CU-09, CU-08, CU-11). */
export const registerSaleController: RequestHandler = async (req, res) => {
  res.status(201).json(await registerSale(requireAuth(req).userId, parseCreateSale(req.body)));
};
