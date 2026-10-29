import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import { getCalendarController } from "../controllers/calendar/index";

/** Calendario reutilizable: cualquier rol; el contenido depende del rol de quien pregunta. */
export const calendarRouter = Router();
calendarRouter.use(authorize(...ALL_ROLES));
calendarRouter.get("/", getCalendarController);
