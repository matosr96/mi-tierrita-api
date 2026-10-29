import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { PayrollPeriodDetailResponse } from "../../models/index";
import { canApprovePeriod } from "./period-status";
import { lockPayrollPeriod } from "./period-queries";
import { getPayrollPeriod } from "./get-period";

/** Borrador → aprobado: desde aquí las líneas ya no se editan. Registra quién y cuándo. 707 si no es borrador. */
export const approvePayrollPeriod = async (id: number, userId: number): Promise<PayrollPeriodDetailResponse> =>
  db.transaction(async (client) => {
    const status = await lockPayrollPeriod(client, id);
    if (!canApprovePeriod(status)) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_EDITABLE);
    await client.query(`UPDATE payroll_periods SET status = 'APPROVED', approved_at = now(), approved_by = $2 WHERE id = $1`, [id, userId]);
    return getPayrollPeriod(id, client);
  });
