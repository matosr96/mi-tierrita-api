import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmResponse, type AlarmRow, type CreateAlarmRequest } from "../../models/index";
import { ALARM_COLUMNS } from "./find-alarm";
import { nextFireAt } from "./next-fire";

/** Tope por persona: evita que un error de la app llene la tabla. */
export const MAX_ALARMS_PER_USER = 50;

/** Crea una alarma propia. Una de una sola vez cuya fecha y hora ya pasaron no se acepta (671). */
export const createAlarm = async (userId: number, input: CreateAlarmRequest): Promise<AlarmResponse> => {
  const next = nextFireAt(input, new Date());
  if (next === null) throw domainError(ErrorCodes.ALARM_SCHEDULE_INVALID);
  const { rows: countRows } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM alarms WHERE user_id = $1`, [userId]);
  if ((countRows[0]?.count ?? 0) >= MAX_ALARMS_PER_USER) throw domainError(ErrorCodes.ALARM_LIMIT_REACHED);
  const { rows } = await db.query<AlarmRow>(
    `WITH a AS (
       INSERT INTO alarms (user_id, title, description, time_of_day, repeat, weekdays, date, area, next_fire_at)
       VALUES ($1, $2, $3, $4::time, $5, $6::smallint[], $7, $8, $9)
       RETURNING *
     ) SELECT ${ALARM_COLUMNS} FROM a`,
    [userId, input.title, input.description, input.timeOfDay, input.repeat, input.weekdays, input.date, input.area, next],
  );
  const row = rows[0];
  if (row === undefined) throw new Error("INSERT de alarma no devolvió fila");
  return toAlarmResponse(row);
};
