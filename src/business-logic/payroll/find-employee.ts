import { db, type Queryable } from "../../data-sources/index";
import type { PayrollEmployeeRow } from "../../models/index";

export const PAYROLL_EMPLOYEE_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName", document_id AS "documentId", position,
  base_salary AS "baseSalary", pay_frequency AS "payFrequency", active, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"`;

export const findPayrollEmployeeById = async (id: number, q: Queryable = db): Promise<PayrollEmployeeRow | undefined> => {
  const { rows } = await q.query<PayrollEmployeeRow>(`SELECT ${PAYROLL_EMPLOYEE_COLUMNS} FROM payroll_employees WHERE id = $1`, [id]);
  return rows[0];
};
