import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import { dueNoticesController } from "../controllers/notifications/index";

/** Avisos de vencimiento: cualquier rol; el contenido depende del rol de quien pregunta. */
export const notificationsRouter = Router();
notificationsRouter.use(authorize(...ALL_ROLES));
notificationsRouter.get("/due", dueNoticesController);
