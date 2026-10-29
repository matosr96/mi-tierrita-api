import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { requireAuth } from "../../security/index";
import { queryAlarmStatus } from "../../models/index";
import { listAlarmFires, listAlarms } from "../../business-logic/alarms/index";

/** GET /api/v1/alarms?status=upcoming|past — cualquier rol. `past` lista los disparos ocurridos. */
export const listAlarmsController: RequestHandler = async (req, res) => {
  const { userId } = requireAuth(req);
  const page = parsePageRequest(req.query);
  res.json(queryAlarmStatus(req.query["status"]) === "past" ? await listAlarmFires(userId, page) : await listAlarms(userId, page));
};
