import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { PayrollPeriodDetailResponse } from "../../models/index";
import { canPayPeriod } from "./period-status";
import { lockPayrollPeriod } from "./period-queries";
import { getPayrollPeriod } from "./get-period";

/** Aprobado → pagado: registra quién lo marcó y cuándo. No mueve dinero ni reporta a la DIAN. 707 si no está aprobado. */
export const payPayrollPeriod = async (id: number, userId: number): Promise<PayrollPeriodDetailResponse> =>
  db.transaction(async (client) => {
    const status = await lockPayrollPeriod(client, id);
    if (!canPayPeriod(status)) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_EDITABLE);
    await client.query(`UPDATE payroll_periods SET status = 'PAID', paid_at = now(), paid_by = $2 WHERE id = $1`, [id, userId]);
    return getPayrollPeriod(id, client);
  });
