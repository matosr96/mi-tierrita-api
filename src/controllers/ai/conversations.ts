import type { RequestHandler } from "express";
import { parseId, parsePageRequest } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCompleteRequest, parseConversationEvent } from "../../models/index";
import { addConversationEvent, completeQuestion, deleteConversation, getConversation, listConversations } from "../../business-logic/ai/index";

/** POST /api/v1/ai/complete — cualquier rol: continuación sugerida de la pregunta que se está escribiendo (modelo rápido). */
export const aiCompleteController: RequestHandler = async (req, res) => {
  requireAuth(req);
  const input = parseCompleteRequest(req.body);
  res.json({ completion: await completeQuestion(input.text, input.screen) });
};

/** GET /api/v1/ai/conversations — cualquier rol: las conversaciones propias, de la más reciente a la más antigua. */
export const listConversationsController: RequestHandler = async (req, res) => {
  res.json(await listConversations(requireAuth(req).userId, parsePageRequest(req.query)));
};

/** GET /api/v1/ai/conversations/:id — cualquier rol: una conversación propia con todos sus mensajes. */
export const getConversationController: RequestHandler = async (req, res) => {
  res.json(await getConversation(requireAuth(req).userId, parseId(req.params["id"])));
};

/** DELETE /api/v1/ai/conversations/:id — cualquier rol: borra una conversación propia. */
export const deleteConversationController: RequestHandler = async (req, res) => {
  await deleteConversation(requireAuth(req).userId, parseId(req.params["id"]));
  res.status(204).end();
};

/** POST /api/v1/ai/conversations/:id/events — cualquier rol: nota de una tarjeta confirmada o descartada. */
export const addConversationEventController: RequestHandler = async (req, res) => {
  res.status(201).json(await addConversationEvent(requireAuth(req).userId, parseId(req.params["id"]), parseConversationEvent(req.body)));
};
