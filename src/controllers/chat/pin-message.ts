import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { setChatPin } from "../../business-logic/chat/index";

/** PUT /api/v1/chat/messages/:id/pin — en el canal general solo ADMIN; en un privado, sus participantes. */
export const pinChatMessageController: RequestHandler = async (req, res) => {
  res.json(await setChatPin(requireAuth(req), parseId(req.params["id"]), true));
};

/** DELETE /api/v1/chat/messages/:id/pin — mismas reglas que fijar. */
export const unpinChatMessageController: RequestHandler = async (req, res) => {
  res.json(await setChatPin(requireAuth(req), parseId(req.params["id"]), false));
};
