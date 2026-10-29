import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmResponse, type AlarmRow } from "../../models/index";
import { ALARM_COLUMNS } from "./find-alarm";

/** Alarmas propias: primero las activas por próximo disparo; las apagadas al final. */
export const listAlarms = async (userId: number, page: PageRequest): Promise<PageResponse<AlarmResponse>> => {
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM alarms WHERE user_id = $1`, [userId]),
    db.query<AlarmRow>(
      `SELECT ${ALARM_COLUMNS} FROM alarms a WHERE a.user_id = $1
       ORDER BY a.active DESC, a.next_fire_at NULLS LAST, a.time_of_day, a.id LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toAlarmResponse));
};
