import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toPayrollPeriodResponse, type PayrollPeriodQuery, type PayrollPeriodResponse, type PayrollPeriodRow } from "../../models/index";
import { PERIOD_COLUMNS, PERIOD_FROM } from "./period-queries";

/** Periodos más recientes primero; `status` y `year` (año de inicio del periodo) opcionales. */
export const listPayrollPeriods = async (page: PageRequest, filter: PayrollPeriodQuery): Promise<PageResponse<PayrollPeriodResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status !== undefined) {
    params.push(filter.status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (filter.year !== undefined) {
    params.push(filter.year);
    conditions.push(`EXTRACT(YEAR FROM p.period_start) = $${params.length}`);
  }
  const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM payroll_periods p ${where}`, params),
    db.query<PayrollPeriodRow>(
      `SELECT ${PERIOD_COLUMNS} FROM ${PERIOD_FROM} ${where}
        ORDER BY p.period_start DESC, p.frequency, p.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toPayrollPeriodResponse));
};
