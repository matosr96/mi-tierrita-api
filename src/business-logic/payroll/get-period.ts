import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import { toPayrollPeriodResponse, type PayrollLineResponse, type PayrollPeriodDetailResponse, type PayrollPeriodRow } from "../../models/index";
import { PERIOD_COLUMNS, PERIOD_FROM } from "./period-queries";

const LINE_COLUMNS = `l.id, l.employee_id AS "employeeId",
  json_build_object('firstName', e.first_name, 'lastName', e.last_name, 'documentId', e.document_id, 'position', e.position) AS employee,
  l.base, l.overtime, l.bonuses, l.transport, l.health, l.pension, l.other_deductions AS "otherDeductions", l.gross, l.deductions, l.net`;

/** Periodo con sus líneas y totales (los que guardó `recomputePeriodTotals`). 706 si no existe. */
export const getPayrollPeriod = async (id: number, q: Queryable = db): Promise<PayrollPeriodDetailResponse> => {
  const { rows } = await q.query<PayrollPeriodRow>(`SELECT ${PERIOD_COLUMNS} FROM ${PERIOD_FROM} WHERE p.id = $1`, [id]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_FOUND);
  const { rows: lines } = await q.query<PayrollLineResponse>(
    `SELECT ${LINE_COLUMNS} FROM payroll_lines l JOIN payroll_employees e ON e.id = l.employee_id
      WHERE l.period_id = $1 ORDER BY e.last_name, e.first_name, l.id`,
    [id],
  );
  return { ...toPayrollPeriodResponse(row), lines };
};
