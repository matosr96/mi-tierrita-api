import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseIdList } from "../../models/index";
import { chatMessagesState } from "../../business-logic/chat/index";

/** GET /api/v1/chat/messages/state?ids=1,2,3 — autenticado. Estado actual de mensajes ya cargados (solo los visibles). */
export const chatMessagesStateController: RequestHandler = async (req, res) => {
  res.json(await chatMessagesState(requireAuth(req).userId, parseIdList(req.query["ids"])));
};
