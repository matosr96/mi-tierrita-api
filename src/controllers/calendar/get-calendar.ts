import type { RequestHandler } from "express";
import { todayIso } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseCalendarRange } from "../../models/index";
import { getCalendar } from "../../business-logic/calendar/index";

/** GET /api/v1/calendar?from=&to= — cualquier rol. Ítems con fecha del rango (máximo 62 días) según el rol. */
export const getCalendarController: RequestHandler = async (req, res) => {
  const { userId, role } = requireAuth(req);
  const { from, to } = parseCalendarRange(req.query as Record<string, unknown>, todayIso());
  res.json(await getCalendar(userId, role, from, to));
};
