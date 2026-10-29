import type { RequestHandler } from "express";
import { ErrorCodes, domainError, isDomainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { requireAuth } from "../../security/index";
import { parseAssistantChatRequest, parseDraftRequest, parseInvoiceImage } from "../../models/index";
import {
  aiEnabled,
  appendAssistantMessage,
  appendFailure,
  appendUserMessage,
  askAssistant,
  conversationTitle,
  createConversation,
  createDraft,
  DRAFT_ROLES,
  getAssistantTask,
  getBriefing,
  readInvoice,
  requireOwnConversation,
  startAssistantTask,
  type AssistantReply,
} from "../../business-logic/ai/index";

/** Respuesta de Tita más dónde quedó guardada (para que la app persista cómo queda cada tarjeta). */
export type AssistantChatResponse = AssistantReply & { conversationId: number; messageId: number; userMessageId: number };
import { config } from "../../server/config";

/** GET /api/v1/ai/status — cualquier rol. La app muestra las funciones de IA solo si `enabled`. */
export const aiStatusController: RequestHandler = (_req, res) => {
  res.json({ enabled: aiEnabled(), model: aiEnabled() ? config.ai.model : null });
};

/**
 * POST /api/v1/ai/chat — cualquier rol; las herramientas se filtran por el rol de quien pregunta. La pregunta y la
 * respuesta quedan en la conversación guardada (`conversationId`; sin él se crea una). Con `asincrono: true` responde
 * 202 `{ tareaId, conversationId }` al instante y la app consulta `GET /ai/mensajes/:tareaId` hasta tener la respuesta.
 */
export const aiChatController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  const input = parseAssistantChatRequest(req.body);
  const question = input.messages[input.messages.length - 1]!;
  const { rows } = await db.query<{ firstName: string }>(`SELECT first_name AS "firstName" FROM users WHERE id = $1`, [auth.userId]);
  const name = rows[0]?.firstName ?? auth.username;
  let conversationId = input.conversationId;
  if (conversationId === undefined) conversationId = await createConversation(auth.userId, conversationTitle(question.content), input.screen);
  else await requireOwnConversation(auth.userId, conversationId);
  const userMessageId = await appendUserMessage(conversationId, question);
  const job = async (): Promise<AssistantChatResponse> => {
    try {
      const reply = await askAssistant(auth.role, auth.userId, name, input.messages, input.screen);
      const messageId = await appendAssistantMessage(conversationId, reply);
      return { ...reply, conversationId, messageId, userMessageId };
    } catch (err) {
      if (isDomainError(err)) await appendFailure(conversationId, err.code).catch(() => undefined);
      throw err;
    }
  };
  if (input.asincrono) {
    res.status(202).json({ tareaId: startAssistantTask(auth.userId, job), conversationId, userMessageId });
    return;
  }
  res.json(await job());
};

/**
 * GET /api/v1/ai/mensajes/:tareaId — segundo paso de la respuesta en dos pasos. 202 `{ tareaId, status: "pending" }`
 * mientras Tita trabaja; 200 con la respuesta cuando está lista; el error con su código si falló; 404 (662) si la
 * tarea no existe, venció o es de otra persona.
 */
export const aiTaskController: RequestHandler = (req, res) => {
  const auth = requireAuth(req);
  const id = typeof req.params["tareaId"] === "string" ? req.params["tareaId"] : "";
  const task = getAssistantTask<AssistantChatResponse>(auth.userId, id);
  if (task.state === "pending") {
    res.status(202).json({ tareaId: task.id, status: "pending" });
    return;
  }
  if (task.state === "failed") throw domainError(task.code, task.details);
  res.json(task.result);
};

/** GET /api/v1/ai/briefing — cualquier rol: recomendaciones del rol y, con IA, un párrafo que las prioriza. */
export const aiBriefingController: RequestHandler = async (req, res) => {
  res.json(await getBriefing(requireAuth(req).role));
};

/** POST /api/v1/ai/invoice — ADMIN, WAREHOUSE: lee la foto de una factura y la cruza con el catálogo. */
export const aiInvoiceController: RequestHandler = async (req, res) => {
  res.json(await readInvoice(parseInvoiceImage(req.body)));
};

/** POST /api/v1/ai/drafts — el rol depende del tipo de borrador (los mismos que ven sus datos). */
export const aiDraftController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  const draft = parseDraftRequest(req.body);
  if (!DRAFT_ROLES[draft.kind].includes(auth.role)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT, { requiredRoles: DRAFT_ROLES[draft.kind] });
  res.json(await createDraft(draft));
};

export * from "./conversations";
