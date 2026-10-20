import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { deleteChatMessage } from "../../business-logic/chat/index";

/** DELETE /api/v1/chat/messages/:id — el autor; en el canal general también ADMIN. Lo elimina para todos. */
export const deleteChatMessageController: RequestHandler = async (req, res) => {
  res.json(await deleteChatMessage(requireAuth(req), parseId(req.params["id"])));
};
