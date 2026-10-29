import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAlarmFireResponse, type AlarmFireResponse, type AlarmFireRow } from "../../models/index";

const FIRE_COLUMNS = `f.id, f.alarm_id AS "alarmId", a.title, a.description, a.area, f.fired_at AS "firedAt", f.seen_at AS "seenAt"`;
const FIRE_FROM = `FROM alarm_fires f JOIN alarms a ON a.id = f.alarm_id`;

/** Alarmas pasadas (disparos) de la persona, de la más reciente a la más antigua. */
export const listAlarmFires = async (userId: number, page: PageRequest): Promise<PageResponse<AlarmFireResponse>> => {
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${FIRE_FROM} WHERE a.user_id = $1`, [userId]),
    db.query<AlarmFireRow>(`SELECT ${FIRE_COLUMNS} ${FIRE_FROM} WHERE a.user_id = $1 ORDER BY f.fired_at DESC, f.id DESC LIMIT $2 OFFSET $3`, [userId, page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toAlarmFireResponse));
};
