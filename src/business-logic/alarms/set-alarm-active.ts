import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmResponse, type AlarmRow } from "../../models/index";
import { ALARM_COLUMNS, findAlarmById } from "./find-alarm";
import { nextFireAt } from "./next-fire";

/** Enciende (recalculando el próximo disparo) o apaga una alarma. Encender una de una sola vez ya pasada responde 671. */
export const setAlarmActive = async (id: number, userId: number, active: boolean): Promise<AlarmResponse> => {
  const current = await findAlarmById(id, userId);
  if (current === undefined) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
  const next = active ? nextFireAt({ timeOfDay: current.timeOfDay, repeat: current.repeat, weekdays: current.weekdays, date: current.date }, new Date()) : null;
  if (active && next === null) throw domainError(ErrorCodes.ALARM_SCHEDULE_INVALID);
  const { rows } = await db.query<AlarmRow>(
    `WITH a AS (
       UPDATE alarms SET active = $3, next_fire_at = $4, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *
     ) SELECT ${ALARM_COLUMNS} FROM a`,
    [id, userId, active, next],
  );
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
  return toAlarmResponse(row);
};
