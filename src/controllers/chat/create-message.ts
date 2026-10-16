import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateChatMessage } from "../../models/index";
import { createChatMessage } from "../../business-logic/chat/index";

/** POST /api/v1/chat/messages — autenticado (todos los roles). */
export const createChatMessageController: RequestHandler = async (req, res) => {
  res.status(201).json(await createChatMessage(requireAuth(req).userId, parseCreateChatMessage(req.body)));
};
