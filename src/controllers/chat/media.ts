import type { RequestHandler } from "express";
import { parsePageRequest, queryId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseChatMediaKind } from "../../models/index";
import { listChatMedia } from "../../business-logic/chat/index";

/** GET /api/v1/chat/media?with=&kind=image|file|audio|link&page=&limit= — autenticado. Contenido de una conversación. */
export const listChatMediaController: RequestHandler = async (req, res) => {
  res.json(await listChatMedia(requireAuth(req).userId, { peerId: queryId(req.query["with"]), kind: parseChatMediaKind(req.query["kind"]) }, parsePageRequest(req.query)));
};
