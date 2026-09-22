import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getSale } from "../../business-logic/sales/index";

/** GET /api/v1/sales/:id — ADMIN, SALES. */
export const getSaleController: RequestHandler = async (req, res) => {
  res.json(await getSale(parseId(req.params["id"])));
};
