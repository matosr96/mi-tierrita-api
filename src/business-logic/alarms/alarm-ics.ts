import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmRow } from "../../models/index";
import { ALARM_COLUMNS, findAlarmById } from "./find-alarm";
import { alarmsToIcs } from "./ics";

/** Calendario de una alarma propia. */
export const alarmIcs = async (id: number, userId: number): Promise<string> => {
  const row = await findAlarmById(id, userId);
  if (row === undefined) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
  return alarmsToIcs([toAlarmResponse(row)]);
};

/** Calendario con todas las alarmas activas de la persona. */
export const allAlarmsIcs = async (userId: number): Promise<string> => {
  const { rows } = await db.query<AlarmRow>(`SELECT ${ALARM_COLUMNS} FROM alarms a WHERE a.user_id = $1 AND a.active ORDER BY a.time_of_day, a.id`, [userId]);
  return alarmsToIcs(rows.map(toAlarmResponse));
};
