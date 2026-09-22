import type { RequestHandler } from "express";
import { parseId, queryInt } from "../../common/index";
import { DEFAULT_OVERDUE_DAYS, getCustomerBalance } from "../../business-logic/customers/index";

/** GET /api/v1/customers/:id/balance?overdueDays=30 — ADMIN, SALES (RF-04.4). */
export const getCustomerBalanceController: RequestHandler = async (req, res) => {
  res.json(await getCustomerBalance(parseId(req.params["id"]), queryInt(req.query["overdueDays"], DEFAULT_OVERDUE_DAYS)));
};
