import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseTitaAction } from "../../models/index";
import { setChatTitaActionState } from "../../business-logic/chat/index";

/** PATCH /api/v1/chat/messages/:id/tita-actions — autenticado. Cómo quedó una tarjeta de Tita (solo quien la invocó). */
export const setChatTitaActionController: RequestHandler = async (req, res) => {
  await setChatTitaActionState(requireAuth(req).userId, parseId(req.params["id"]), parseTitaAction(req.body));
  res.status(204).end();
};
