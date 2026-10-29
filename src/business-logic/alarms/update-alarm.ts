import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmResponse, type AlarmRow, type UpdateAlarmRequest } from "../../models/index";
import { ALARM_COLUMNS } from "./find-alarm";
import { nextFireAt } from "./next-fire";

/** Reemplaza la programación y recalcula el próximo disparo; si la alarma estaba apagada, editarla la vuelve a encender. */
export const updateAlarm = async (id: number, userId: number, input: UpdateAlarmRequest): Promise<AlarmResponse> => {
  const next = nextFireAt(input, new Date());
  if (next === null) throw domainError(ErrorCodes.ALARM_SCHEDULE_INVALID);
  const { rows } = await db.query<AlarmRow>(
    `WITH a AS (
       UPDATE alarms
          SET title = $3, description = $4, time_of_day = $5::time, repeat = $6, weekdays = $7::smallint[], date = $8, area = $9,
              next_fire_at = $10, active = true, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING *
     ) SELECT ${ALARM_COLUMNS} FROM a`,
    [id, userId, input.title, input.description, input.timeOfDay, input.repeat, input.weekdays, input.date, input.area, next],
  );
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
  return toAlarmResponse(row);
};
