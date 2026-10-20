import type { RequestHandler } from "express";
import { ErrorCodes, domainError, queryId, queryInt, queryString } from "../../common/index";
import { requireAuth } from "../../security/index";
import { searchChatMessages } from "../../business-logic/chat/index";

/** GET /api/v1/chat/search?q=&with=&general=true&limit= — autenticado. Busca solo en lo que la persona puede ver. */
export const searchChatMessagesController: RequestHandler = async (req, res) => {
  const q = queryString(req.query["q"], 100);
  if (q === undefined || q.length < 2) throw domainError(ErrorCodes.VALIDATION, [{ path: "q", message: "Mínimo 2 caracteres" }]);
  res.json(
    await searchChatMessages(requireAuth(req).userId, {
      q,
      peerId: queryId(req.query["with"]),
      generalOnly: req.query["general"] === "true",
      limit: queryInt(req.query["limit"], 30, 60),
    }),
  );
};
