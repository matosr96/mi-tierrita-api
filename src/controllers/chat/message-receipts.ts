import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { chatMessageReceipts } from "../../business-logic/chat/index";

/** GET /api/v1/chat/messages/:id/receipts — solo el autor del mensaje. Quién lo leyó, a quién le llegó y quién falta. */
export const chatMessageReceiptsController: RequestHandler = async (req, res) => {
  res.json(await chatMessageReceipts(requireAuth(req).userId, parseId(req.params["id"])));
};
