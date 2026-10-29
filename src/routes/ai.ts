import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authorize, Roles, getAuth } from "../security/index";
import { ErrorCodes } from "../common/index";
import {
  addConversationEventController,
  aiBriefingController,
  aiCompleteController,
  aiChatController,
  aiDraftController,
  aiInvoiceController,
  aiStatusController,
  aiTaskController,
  deleteConversationController,
  getConversationController,
  listConversationsController,
} from "../controllers/ai/index";

/** Cada llamada al modelo cuesta: tope por persona (no por IP) para las rutas que consultan a Claude. */
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `u${getAuth(req)?.userId ?? 0}`,
  handler: (_req, res) => {
    res.status(429).json({ message: ErrorCodes.TOO_MANY_ATTEMPTS });
  },
});

/**
 * Asistente de IA (Claude). Ninguna ruta escribe datos de negocio: proponen y la persona confirma en la pantalla de
 * cada módulo. Lo único que se guarda es el historial de conversaciones de cada persona.
 */
/** El autocompletado se pide con cada pausa al escribir: tope propio, más alto y más corto. */
const completeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `c${getAuth(req)?.userId ?? 0}`,
  handler: (_req, res) => {
    res.status(429).json({ message: ErrorCodes.TOO_MANY_ATTEMPTS });
  },
});

export const aiRouter = Router();
aiRouter.get("/status", aiStatusController);
aiRouter.post("/complete", completeLimiter, aiCompleteController);
aiRouter.get("/briefing", aiBriefingController);
aiRouter.post("/chat", aiLimiter, aiChatController);
// Segundo paso de la respuesta en dos pasos: consultar no cuenta para el tope (es la misma pregunta).
aiRouter.get("/mensajes/:tareaId", aiTaskController);
aiRouter.get("/conversations", listConversationsController);
aiRouter.get("/conversations/:id", getConversationController);
aiRouter.delete("/conversations/:id", deleteConversationController);
aiRouter.post("/conversations/:id/events", addConversationEventController);
aiRouter.post("/drafts", aiLimiter, aiDraftController);
aiRouter.post("/invoice", aiLimiter, authorize(Roles.ADMIN, Roles.WAREHOUSE), aiInvoiceController);
