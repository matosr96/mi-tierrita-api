import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseTitaAction } from "../../models/index";
import { setCommentTitaAction } from "../../business-logic/ai/index";

/** PATCH /api/v1/comments/:id/tita-actions — autenticado. Cómo quedó una tarjeta de Tita en un comentario (solo quien la invocó). */
export const setCommentTitaActionController: RequestHandler = async (req, res) => {
  await setCommentTitaAction(requireAuth(req).userId, parseId(req.params["id"]), parseTitaAction(req.body));
  res.status(204).end();
};
