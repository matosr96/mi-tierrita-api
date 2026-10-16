import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { chatTeam } from "../../business-logic/chat/index";

/** GET /api/v1/chat/team — autenticado. Presencia, no leídos y último mensaje por conversación. */
export const chatTeamController: RequestHandler = async (req, res) => {
  res.json(await chatTeam(requireAuth(req).userId));
};
