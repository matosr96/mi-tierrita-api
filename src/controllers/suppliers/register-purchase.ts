import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseCreatePurchase } from "../../models/index";
import { registerPurchase } from "../../business-logic/suppliers/index";

/** POST /api/v1/suppliers/:id/purchases — ADMIN, WAREHOUSE (CU-13). */
export const registerPurchaseController: RequestHandler = async (req, res) => {
  res.status(201).json(await registerPurchase(parseId(req.params["id"]), parseCreatePurchase(req.body)));
};
