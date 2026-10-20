import type { RequestHandler } from "express";
import { queryId, queryInt } from "../../common/index";
import { requireAuth } from "../../security/index";
import { listChatMessages } from "../../business-logic/chat/index";

/**
 * GET /api/v1/chat/messages?with=&thread=&after=&before=&around=&limit= — autenticado. Sin `with`, canal general; con
 * `with`, el privado; con `thread`, las respuestas de ese hilo.
 */
export const listChatMessagesController: RequestHandler = async (req, res) => {
  res.json(
    await listChatMessages(requireAuth(req).userId, {
      peerId: queryId(req.query["with"]),
      threadRootId: queryId(req.query["thread"]),
      after: queryId(req.query["after"]),
      before: queryId(req.query["before"]),
      around: queryId(req.query["around"]),
      limit: queryInt(req.query["limit"], 50, 100),
    }),
  );
};
