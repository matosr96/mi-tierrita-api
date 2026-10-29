import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";

/** Borrado físico; los disparos pasados se van con ella (ON DELETE CASCADE). */
export const deleteAlarm = async (id: number, userId: number): Promise<void> => {
  const { rowCount } = await db.query(`DELETE FROM alarms WHERE id = $1 AND user_id = $2`, [id, userId]);
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
};
