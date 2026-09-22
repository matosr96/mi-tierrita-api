import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { voidSale } from "../../business-logic/sales/index";

/** POST /api/v1/sales/:id/void — ADMIN (RF-03.4). */
export const voidSaleController: RequestHandler = async (req, res) => {
  res.json(await voidSale(parseId(req.params["id"]), requireAuth(req).userId));
};
