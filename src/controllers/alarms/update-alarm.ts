import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseUpdateAlarm } from "../../models/index";
import { updateAlarm } from "../../business-logic/alarms/index";

/** PUT /api/v1/alarms/:id — cualquier rol (solo la propia). */
export const updateAlarmController: RequestHandler = async (req, res) => {
  res.json(await updateAlarm(parseId(req.params["id"]), requireAuth(req).userId, parseUpdateAlarm(req.body)));
};
