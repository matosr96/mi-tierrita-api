import type { RequestHandler } from "express";
import { queryId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { listChatPins } from "../../business-logic/chat/index";

/** GET /api/v1/chat/pins?with= — autenticado. Mensajes fijados del canal general o del privado. */
export const listChatPinsController: RequestHandler = async (req, res) => {
  res.json(await listChatPins(requireAuth(req).userId, queryId(req.query["with"])));
};
