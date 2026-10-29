import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { alarmIcs, allAlarmsIcs } from "../../business-logic/alarms/index";

const sendIcs = (res: Parameters<RequestHandler>[1], filename: string, ics: string): void => {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(ics);
};

/** GET /api/v1/alarms/:id/ics — cualquier rol. Archivo `alarma-<id>.ics` para el calendario del teléfono. */
export const alarmIcsController: RequestHandler = async (req, res) => {
  const id = parseId(req.params["id"]);
  sendIcs(res, `alarma-${id}.ics`, await alarmIcs(id, requireAuth(req).userId));
};

/** GET /api/v1/alarms/ics — cualquier rol. Todas las alarmas activas en un solo archivo. */
export const allAlarmsIcsController: RequestHandler = async (req, res) => {
  sendIcs(res, "alarmas-mi-tierrita.ics", await allAlarmsIcs(requireAuth(req).userId));
};
