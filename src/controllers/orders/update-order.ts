import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateOrder } from "../../models/index";
import { requireAuth } from "../../security/index";
import { updateOrder } from "../../business-logic/orders/index";

/** PUT /api/v1/orders/:id — quien maneje ese tipo; solo pedidos pendientes (701). */
export const updateOrderController: RequestHandler = async (req, res) => {
  res.json(await updateOrder(parseId(req.params["id"]), requireAuth(req).role, parseUpdateOrder(req.body)));
};
