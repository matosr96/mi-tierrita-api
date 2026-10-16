import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/index";
import { authorize, Roles } from "../security/index";
import { createContactMessageController, listContactMessagesController, updateContactMessageController } from "../controllers/contact/index";

/** Un visitante puede dejar pocos mensajes seguidos: más de 5 en una hora desde la misma IP responde 429 (640). */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

/** Ruta pública del formulario de la página pública: se monta ANTES del middleware authenticate. */
export const contactPublicRouter = Router();
contactPublicRouter.post("/", contactLimiter, createContactMessageController);

/** Bandeja de contactos del sitio (prototipo 12): solo ADMIN. */
export const contactMessagesRouter = Router();
contactMessagesRouter.get("/", authorize(Roles.ADMIN), listContactMessagesController);
contactMessagesRouter.patch("/:id", authorize(Roles.ADMIN), updateContactMessageController);
