import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseEditChatMessage } from "../../models/index";
import { editChatMessage } from "../../business-logic/chat/index";

/** PATCH /api/v1/chat/messages/:id — solo el autor. Corrige el texto (queda la marca "editado"). */
export const editChatMessageController: RequestHandler = async (req, res) => {
  res.json(await editChatMessage(requireAuth(req).userId, parseId(req.params["id"]), parseEditChatMessage(req.body).body));
};
