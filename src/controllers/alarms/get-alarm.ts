import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { getAlarm } from "../../business-logic/alarms/index";

/** GET /api/v1/alarms/:id — cualquier rol (solo la propia). */
export const getAlarmController: RequestHandler = async (req, res) => {
  res.json(await getAlarm(parseId(req.params["id"]), requireAuth(req).userId));
};
