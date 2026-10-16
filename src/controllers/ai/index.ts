import type { RequestHandler } from "express";
import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { requireAuth } from "../../security/index";
import { parseAssistantChat, parseDraftRequest, parseInvoiceImage } from "../../models/index";
import { aiEnabled, askAssistant, createDraft, DRAFT_ROLES, getBriefing, readInvoice } from "../../business-logic/ai/index";
import { config } from "../../server/config";

/** GET /api/v1/ai/status — cualquier rol. La app muestra las funciones de IA solo si `enabled`. */
export const aiStatusController: RequestHandler = (_req, res) => {
  res.json({ enabled: aiEnabled(), model: aiEnabled() ? config.ai.model : null });
};

/** POST /api/v1/ai/chat — cualquier rol; las herramientas se filtran por el rol de quien pregunta. */
export const aiChatController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  const turns = parseAssistantChat(req.body);
  const { rows } = await db.query<{ firstName: string }>(`SELECT first_name AS "firstName" FROM users WHERE id = $1`, [auth.userId]);
  res.json(await askAssistant(auth.role, auth.userId, rows[0]?.firstName ?? auth.username, turns));
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
