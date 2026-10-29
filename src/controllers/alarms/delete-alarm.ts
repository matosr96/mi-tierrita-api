import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { deleteAlarm } from "../../business-logic/alarms/index";

/** DELETE /api/v1/alarms/:id — cualquier rol (solo la propia). */
export const deleteAlarmController: RequestHandler = async (req, res) => {
  await deleteAlarm(parseId(req.params["id"]), requireAuth(req).userId);
  res.status(204).send();
};
