import { ErrorCodes, domainError } from "../../common/index";
import type { Queryable } from "../../data-sources/index";
import type { PayrollStatus } from "../../models/index";

const person = (alias: string): string =>
  `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object('id', ${alias}.id, 'firstName', ${alias}.first_name, 'lastName', ${alias}.last_name) END`;

/** Columnas de un periodo con quién lo creó, aprobó y pagó. Requiere `PERIOD_FROM`. */
export const PERIOD_COLUMNS = `p.id, p.frequency, p.period_start AS "periodStart", p.period_end AS "periodEnd", p.pay_date AS "payDate", p.status,
  p.total_gross AS "totalGross", p.total_deductions AS "totalDeductions", p.total_net AS "totalNet",
  (SELECT count(*)::int FROM payroll_lines l WHERE l.period_id = p.id) AS "employeeCount",
  ${person("cu")} AS "createdBy", ${person("au")} AS "approvedBy", ${person("pu")} AS "paidBy",
  p.approved_at AS "approvedAt", p.paid_at AS "paidAt", p.created_at AS "createdAt"`;

export const PERIOD_FROM = `payroll_periods p
  JOIN users cu ON cu.id = p.created_by
  LEFT JOIN users au ON au.id = p.approved_by
  LEFT JOIN users pu ON pu.id = p.paid_by`;

/** Bloquea el periodo dentro de una transacción y devuelve su estado. 706 si no existe. */
export const lockPayrollPeriod = async (q: Queryable, id: number): Promise<PayrollStatus> => {
  const { rows } = await q.query<{ status: PayrollStatus }>(`SELECT status FROM payroll_periods WHERE id = $1 FOR UPDATE`, [id]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_FOUND);
  return row.status;
};

/** Los totales del periodo son la suma de sus líneas; se recalculan en la misma transacción que las cambia. */
export const recomputePeriodTotals = async (q: Queryable, id: number): Promise<void> => {
  await q.query(
    `UPDATE payroll_periods p
        SET total_gross = s.gross, total_deductions = s.deductions, total_net = s.net
       FROM (SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(deductions), 0) AS deductions, COALESCE(SUM(net), 0) AS net
               FROM payroll_lines WHERE period_id = $1) s
      WHERE p.id = $1`,
    [id],
  );
};
