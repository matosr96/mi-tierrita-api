import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authorize, Roles, getAuth } from "../security/index";
import { ErrorCodes } from "../common/index";
import { aiBriefingController, aiChatController, aiDraftController, aiInvoiceController, aiStatusController } from "../controllers/ai/index";

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

/** Asistente de IA (Claude). Ninguna ruta escribe en la base: proponen y la persona confirma en la pantalla de cada módulo. */
export const aiRouter = Router();
aiRouter.get("/status", aiStatusController);
aiRouter.get("/briefing", aiBriefingController);
aiRouter.post("/chat", aiLimiter, aiChatController);
aiRouter.post("/drafts", aiLimiter, aiDraftController);
aiRouter.post("/invoice", aiLimiter, authorize(Roles.ADMIN, Roles.WAREHOUSE), aiInvoiceController);
