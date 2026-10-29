import type { RequestHandler } from "express";
import { parseCreateOrder } from "../../models/index";
import { requireAuth } from "../../security/index";
import { createOrder } from "../../business-logic/orders/index";

/** POST /api/v1/orders — SUPPLIER: ADMIN, WAREHOUSE; CUSTOMER: ADMIN, SALES. */
export const createOrderController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.status(201).json(await createOrder(auth.userId, auth.role, parseCreateOrder(req.body)));
};
