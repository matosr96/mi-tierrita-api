import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import type { CreatePayrollPeriodRequest, PayFrequency, PayrollPeriodDetailResponse } from "../../models/index";
import { liquidateLine, prorateBase } from "./liquidate";
import { recomputePeriodTotals } from "./period-queries";
import { getPayrollPeriod } from "./get-period";

/**
 * Crea un periodo en borrador con una línea por cada empleado activo de esa frecuencia: salario base prorrateado
 * (quincenal = mitad del mensual), sin horas extra, bonificaciones, auxilio ni otros descuentos; salud y pensión
 * ya liquidadas. 708 si ya existe un periodo de esa frecuencia con la misma fecha de inicio; 709 si no hay empleados
 * activos de esa frecuencia.
 */
export const createPayrollPeriod = async (input: CreatePayrollPeriodRequest, userId: number): Promise<PayrollPeriodDetailResponse> =>
  db.transaction(async (client) => {
    let periodId: number;
    try {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO payroll_periods (frequency, period_start, period_end, pay_date, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.frequency, input.periodStart, input.periodEnd, input.payDate, userId],
      );
      const row = rows[0];
      if (row === undefined) throw new Error("INSERT de periodo de nómina no devolvió fila");
      periodId = row.id;
    } catch (err) {
      if (isUniqueViolation(err)) throw domainError(ErrorCodes.PAYROLL_PERIOD_DUPLICATE);
      throw err;
    }

    const { rows: employees } = await client.query<{ id: number; baseSalary: number; payFrequency: PayFrequency }>(
      `SELECT id, base_salary AS "baseSalary", pay_frequency AS "payFrequency" FROM payroll_employees
        WHERE active AND pay_frequency = $1 ORDER BY id`,
      [input.frequency],
    );
    if (employees.length === 0) throw domainError(ErrorCodes.PAYROLL_NO_ACTIVE_EMPLOYEES);

    for (const employee of employees) {
      const base = prorateBase(employee.baseSalary, input.frequency);
      const result = liquidateLine({ base, overtime: 0, bonuses: 0, transport: 0, otherDeductions: 0 });
      await client.query(
        `INSERT INTO payroll_lines (period_id, employee_id, base, health, pension, gross, deductions, net)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [periodId, employee.id, base, result.health, result.pension, result.gross, result.deductions, result.net],
      );
    }
    await recomputePeriodTotals(client, periodId);
    return getPayrollPeriod(periodId, client);
  });
