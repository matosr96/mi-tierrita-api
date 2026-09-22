import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCreatePayment } from "../../models/index";
import { registerPayment } from "../../business-logic/customers/index";

/** POST /api/v1/customers/:id/payments — ADMIN, SALES (CU-12). */
export const registerPaymentController: RequestHandler = async (req, res) => {
  res.status(201).json(await registerPayment(parseId(req.params["id"]), requireAuth(req).userId, parseCreatePayment(req.body)));
};
