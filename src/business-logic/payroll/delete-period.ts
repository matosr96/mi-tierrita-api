import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { isPeriodEditable } from "./period-status";
import { lockPayrollPeriod } from "./period-queries";

/** Elimina un borrador y sus líneas (ON DELETE CASCADE). Un periodo aprobado o pagado no se borra: 707. */
export const deletePayrollPeriod = async (id: number): Promise<void> =>
  db.transaction(async (client) => {
    const status = await lockPayrollPeriod(client, id);
    if (!isPeriodEditable(status)) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_EDITABLE);
    await client.query(`DELETE FROM payroll_periods WHERE id = $1`, [id]);
  });
