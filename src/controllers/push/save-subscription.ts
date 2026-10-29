import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parsePushSubscription } from "../../models/index";
import { savePushSubscription } from "../../business-logic/push/index";

/** POST /api/v1/push/subscriptions — cualquier rol. Guarda o reemplaza la suscripción de este dispositivo. */
export const savePushSubscriptionController: RequestHandler = async (req, res) => {
  res.status(201).json(await savePushSubscription(requireAuth(req).userId, parsePushSubscription(req.body)));
};
