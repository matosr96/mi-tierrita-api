import type { RequestHandler } from "express";
import { ErrorCodes, domainError, queryId, queryInt, queryString } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseSearchDay } from "../../models/index";
import { searchChatMessages } from "../../business-logic/chat/index";

/**
 * GET /api/v1/chat/search?q=&day=YYYY-MM-DD&with=&general=true&limit= — autenticado. Busca solo en lo que la persona
 * puede ver. Hace falta `q` (2 caracteres o más) o `day`; con `day`, el texto es opcional.
 */
export const searchChatMessagesController: RequestHandler = async (req, res) => {
  const q = queryString(req.query["q"], 100);
  const day = parseSearchDay(req.query["day"]);
  if (day === undefined && (q === undefined || q.length < 2)) throw domainError(ErrorCodes.VALIDATION, [{ path: "q", message: "Mínimo 2 caracteres" }]);
  res.json(
    await searchChatMessages(requireAuth(req).userId, {
      q: q !== undefined && q.length >= 2 ? q : undefined,
      day,
      peerId: queryId(req.query["with"]),
      generalOnly: req.query["general"] === "true",
      limit: queryInt(req.query["limit"], 30, 60),
    }),
  );
};
