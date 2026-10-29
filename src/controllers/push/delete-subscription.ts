import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseDeletePushSubscription } from "../../models/index";
import { deletePushSubscription } from "../../business-logic/push/index";

/** DELETE /api/v1/push/subscriptions — cualquier rol. Cuerpo { endpoint }. */
export const deletePushSubscriptionController: RequestHandler = async (req, res) => {
  await deletePushSubscription(requireAuth(req).userId, parseDeletePushSubscription(req.body).endpoint);
  res.status(204).send();
};
