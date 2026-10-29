import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toPayrollEmployeeResponse, type PayrollEmployeeResponse, type PayrollEmployeeRow, type UpdatePayrollEmployeeRequest } from "../../models/index";
import { PAYROLL_EMPLOYEE_COLUMNS } from "./find-employee";
import { translateEmployeeError } from "./employee-errors";

/**
 * Edita un empleado (incluye activar o desactivar con `active`). Los cambios de salario o frecuencia valen para los
 * periodos que se creen después: las líneas ya liquidadas conservan su valor.
 */
export const updatePayrollEmployee = async (id: number, input: UpdatePayrollEmployeeRequest): Promise<PayrollEmployeeResponse> => {
  let row: PayrollEmployeeRow | undefined;
  try {
    const { rows } = await db.query<PayrollEmployeeRow>(
      `UPDATE payroll_employees
          SET first_name = COALESCE($2, first_name),
              last_name = COALESCE($3, last_name),
              document_id = COALESCE($4, document_id),
              position = COALESCE($5, position),
              base_salary = COALESCE($6, base_salary),
              pay_frequency = COALESCE($7, pay_frequency),
              active = COALESCE($8, active),
              user_id = CASE WHEN $9::boolean THEN $10::bigint ELSE user_id END,
              updated_at = now()
        WHERE id = $1
        RETURNING ${PAYROLL_EMPLOYEE_COLUMNS}`,
      [
        id,
        input.firstName ?? null,
        input.lastName ?? null,
        input.documentId ?? null,
        input.position ?? null,
        input.baseSalary ?? null,
        input.payFrequency ?? null,
        input.active ?? null,
        input.userId !== undefined,
        input.userId ?? null,
      ],
    );
    row = rows[0];
  } catch (err) {
    throw translateEmployeeError(err);
  }
  if (row === undefined) throw domainError(ErrorCodes.PAYROLL_EMPLOYEE_NOT_FOUND);
  return toPayrollEmployeeResponse(row);
};
