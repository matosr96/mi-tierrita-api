import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseMarkChatRead } from "../../models/index";
import { markChatRead } from "../../business-logic/chat/index";

/** POST /api/v1/chat/read — autenticado. Marca como vistos los mensajes de una conversación o de un hilo. */
export const markChatReadController: RequestHandler = async (req, res) => {
  res.json(await markChatRead(requireAuth(req).userId, parseMarkChatRead(req.body)));
};
