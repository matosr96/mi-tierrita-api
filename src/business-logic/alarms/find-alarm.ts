import { db, type Queryable } from "../../data-sources/index";
import type { AlarmRow } from "../../models/index";

export const ALARM_COLUMNS = `
  a.id, a.user_id AS "userId", a.title, a.description, a.time_of_day::text AS "timeOfDay", a.repeat, a.weekdays,
  a.date, a.area, a.active, a.next_fire_at AS "nextFireAt", a.last_fired_at AS "lastFiredAt",
  a.created_at AS "createdAt", a.updated_at AS "updatedAt"`;

/** Una alarma solo existe para su dueño: cualquier otra persona recibe «no existe». */
export const findAlarmById = async (id: number, userId: number, q: Queryable = db): Promise<AlarmRow | undefined> => {
  const { rows } = await q.query<AlarmRow>(`SELECT ${ALARM_COLUMNS} FROM alarms a WHERE a.id = $1 AND a.user_id = $2`, [id, userId]);
  return rows[0];
};
