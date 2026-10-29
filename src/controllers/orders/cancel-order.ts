import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { cancelOrder } from "../../business-logic/orders/index";

/** POST /api/v1/orders/:id/cancel — quien maneje ese tipo; pedidos abiertos (703 si ya se cerró). */
export const cancelOrderController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await cancelOrder(parseId(req.params["id"]), auth.userId, auth.role));
};
