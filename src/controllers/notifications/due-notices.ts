import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { listDueItems } from "../../business-logic/notifications/index";

/** GET /api/v1/notifications/due — cualquier rol. Avisos de vencimiento calculados en el servidor según el rol. */
export const dueNoticesController: RequestHandler = async (req, res) => {
  res.json(await listDueItems(requireAuth(req).role));
};
