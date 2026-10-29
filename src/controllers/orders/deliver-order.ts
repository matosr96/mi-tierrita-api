import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseDeliverOrder } from "../../models/index";
import { requireAuth } from "../../security/index";
import { deliverOrder } from "../../business-logic/orders/index";

/** POST /api/v1/orders/:id/deliver — ADMIN, SALES (pedido de cliente). */
export const deliverOrderController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await deliverOrder(parseId(req.params["id"]), auth.userId, auth.role, parseDeliverOrder(req.body)));
};
