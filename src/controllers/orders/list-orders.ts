import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { parseOrderListFilter } from "../../models/index";
import { requireAuth } from "../../security/index";
import { listOrders } from "../../business-logic/orders/index";

/** GET /api/v1/orders — cualquier rol, solo los tipos que maneja (?kind= ajeno → 613). Filtros: kind, status, from, to, q. */
export const listOrdersController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await listOrders(auth.role, parsePageRequest(req.query), parseOrderListFilter(req.query)));
};
