import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import {
  alarmIcsController,
  allAlarmsIcsController,
  createAlarmController,
  deleteAlarmController,
  getAlarmController,
  listAlarmsController,
  setAlarmActiveController,
  updateAlarmController,
} from "../controllers/alarms/index";

/** Alarmas personalizadas: los tres roles, cada quien las suyas (la propiedad se aplica en la lógica de negocio). */
export const alarmsRouter = Router();
alarmsRouter.use(authorize(...ALL_ROLES));
alarmsRouter.get("/ics", allAlarmsIcsController);
alarmsRouter.get("/", listAlarmsController);
alarmsRouter.post("/", createAlarmController);
alarmsRouter.get("/:id/ics", alarmIcsController);
alarmsRouter.get("/:id", getAlarmController);
alarmsRouter.put("/:id", updateAlarmController);
alarmsRouter.patch("/:id/active", setAlarmActiveController);
alarmsRouter.delete("/:id", deleteAlarmController);
