import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { getOrder } from "../../business-logic/orders/index";

/** GET /api/v1/orders/:id — quien maneje ese tipo de pedido. */
export const getOrderController: RequestHandler = async (req, res) => {
  res.json(await getOrder(parseId(req.params["id"]), requireAuth(req).role));
};
