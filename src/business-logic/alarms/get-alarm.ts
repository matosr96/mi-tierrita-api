import { ErrorCodes, domainError } from "../../common/index";
import { toAlarmResponse, type AlarmResponse } from "../../models/index";
import { findAlarmById } from "./find-alarm";

export const getAlarm = async (id: number, userId: number): Promise<AlarmResponse> => {
  const row = await findAlarmById(id, userId);
  if (row === undefined) throw domainError(ErrorCodes.ALARM_NOT_FOUND);
  return toAlarmResponse(row);
};
