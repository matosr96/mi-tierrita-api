import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { markChatPlayed } from "../../business-logic/chat/index";

/** POST /api/v1/chat/messages/:id/played — autenticado. Marca que quien llama reprodujo la nota de voz (mensaje ajeno con audio). */
export const markChatPlayedController: RequestHandler = async (req, res) => {
  res.json(await markChatPlayed(requireAuth(req).userId, parseId(req.params["id"])));
};
