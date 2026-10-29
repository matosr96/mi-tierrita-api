import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseReceiveOrder } from "../../models/index";
import { requireAuth } from "../../security/index";
import { receiveOrder } from "../../business-logic/orders/index";

/** POST /api/v1/orders/:id/receive — ADMIN, WAREHOUSE (pedido a proveedor). */
export const receiveOrderController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await receiveOrder(parseId(req.params["id"]), auth.userId, auth.role, parseReceiveOrder(req.body)));
};
