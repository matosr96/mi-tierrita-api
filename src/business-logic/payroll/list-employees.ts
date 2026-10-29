import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toPayrollEmployeeResponse, type PayrollEmployeeQuery, type PayrollEmployeeResponse, type PayrollEmployeeRow } from "../../models/index";
import { PAYROLL_EMPLOYEE_COLUMNS } from "./find-employee";

export const listPayrollEmployees = async (page: PageRequest, filter: PayrollEmployeeQuery): Promise<PageResponse<PayrollEmployeeResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.active !== undefined) {
    params.push(filter.active);
    conditions.push(`active = $${params.length}`);
  }
  if (filter.frequency !== undefined) {
    params.push(filter.frequency);
    conditions.push(`pay_frequency = $${params.length}`);
  }
  const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM payroll_employees ${where}`, params),
    db.query<PayrollEmployeeRow>(
      `SELECT ${PAYROLL_EMPLOYEE_COLUMNS} FROM payroll_employees ${where}
        ORDER BY active DESC, last_name, first_name, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toPayrollEmployeeResponse));
};
