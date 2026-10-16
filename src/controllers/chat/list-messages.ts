import type { RequestHandler } from "express";
import { queryId, queryInt } from "../../common/index";
import { listChatMessages } from "../../business-logic/chat/index";

/** GET /api/v1/chat/messages?after=&limit= — autenticado (todos los roles). */
export const listChatMessagesController: RequestHandler = async (req, res) => {
  res.json(await listChatMessages({ after: queryId(req.query["after"]), limit: queryInt(req.query["limit"], 50, 100) }));
};
