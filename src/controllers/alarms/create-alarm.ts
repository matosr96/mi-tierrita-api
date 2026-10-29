import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateAlarm } from "../../models/index";
import { createAlarm } from "../../business-logic/alarms/index";

/** POST /api/v1/alarms — cualquier rol (alarma propia). */
export const createAlarmController: RequestHandler = async (req, res) => {
  res.status(201).json(await createAlarm(requireAuth(req).userId, parseCreateAlarm(req.body)));
};
