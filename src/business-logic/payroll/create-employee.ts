import { db } from "../../data-sources/index";
import { toPayrollEmployeeResponse, type CreatePayrollEmployeeRequest, type PayrollEmployeeResponse, type PayrollEmployeeRow } from "../../models/index";
import { PAYROLL_EMPLOYEE_COLUMNS } from "./find-employee";
import { translateEmployeeError } from "./employee-errors";

export const createPayrollEmployee = async (input: CreatePayrollEmployeeRequest): Promise<PayrollEmployeeResponse> => {
  try {
    const { rows } = await db.query<PayrollEmployeeRow>(
      `INSERT INTO payroll_employees (first_name, last_name, document_id, position, base_salary, pay_frequency, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${PAYROLL_EMPLOYEE_COLUMNS}`,
      [input.firstName, input.lastName, input.documentId, input.position, input.baseSalary, input.payFrequency, input.userId ?? null],
    );
    const row = rows[0];
    if (row === undefined) throw new Error("INSERT de empleado no devolvió fila");
    return toPayrollEmployeeResponse(row);
  } catch (err) {
    throw translateEmployeeError(err);
  }
};
