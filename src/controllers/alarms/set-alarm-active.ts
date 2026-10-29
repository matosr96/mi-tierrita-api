import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseSetAlarmActive } from "../../models/index";
import { setAlarmActive } from "../../business-logic/alarms/index";

/** PATCH /api/v1/alarms/:id/active — cualquier rol (solo la propia). Cuerpo { active }. */
export const setAlarmActiveController: RequestHandler = async (req, res) => {
  res.json(await setAlarmActive(parseId(req.params["id"]), requireAuth(req).userId, parseSetAlarmActive(req.body).active));
};
