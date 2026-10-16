import type { RequestHandler } from "express";
import { queryId, queryInt } from "../../common/index";
import { requireAuth } from "../../security/index";
import { listChatMessages } from "../../business-logic/chat/index";

/** GET /api/v1/chat/messages?with=&after=&limit= — autenticado. Sin `with`, canal general; con `with`, la conversación privada. */
export const listChatMessagesController: RequestHandler = async (req, res) => {
  res.json(
    await listChatMessages(requireAuth(req).userId, {
      peerId: queryId(req.query["with"]),
      after: queryId(req.query["after"]),
      limit: queryInt(req.query["limit"], 50, 100),
    }),
  );
};
