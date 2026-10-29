import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { PayrollPeriodDetailResponse, UpdatePayrollLineRequest } from "../../models/index";
import { liquidateLine, roundPesos } from "./liquidate";
import { isPeriodEditable } from "./period-status";
import { lockPayrollPeriod, recomputePeriodTotals } from "./period-queries";
import { getPayrollPeriod } from "./get-period";

type LineValues = { base: number; overtime: number; bonuses: number; transport: number; otherDeductions: number };

/**
 * Cambia lo que se escribe a mano en una línea (horas extra/recargos, bonificaciones, auxilio de transporte, otros
 * descuentos) y recalcula en el servidor salud, pensión, devengado, deducciones, neto y los totales del periodo.
 * Solo en borrador (707); 706 si el periodo o la línea no existen. Si las deducciones superan el devengado responde
 * 400 en `otherDeductions`.
 */
export const updatePayrollLine = async (periodId: number, lineId: number, input: UpdatePayrollLineRequest): Promise<PayrollPeriodDetailResponse> =>
  db.transaction(async (client) => {
    const status = await lockPayrollPeriod(client, periodId);
    if (!isPeriodEditable(status)) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_EDITABLE);

    const { rows } = await client.query<LineValues>(
      `SELECT base, overtime, bonuses, transport, other_deductions AS "otherDeductions"
         FROM payroll_lines WHERE id = $1 AND period_id = $2 FOR UPDATE`,
      [lineId, periodId],
    );
    const current = rows[0];
    if (current === undefined) throw domainError(ErrorCodes.PAYROLL_PERIOD_NOT_FOUND);

    const values: LineValues = {
      base: current.base,
      overtime: roundPesos(input.overtime ?? current.overtime),
      bonuses: roundPesos(input.bonuses ?? current.bonuses),
      transport: roundPesos(input.transport ?? current.transport),
      otherDeductions: roundPesos(input.otherDeductions ?? current.otherDeductions),
    };
    const result = liquidateLine(values);
    if (result.net < 0) {
      throw domainError(ErrorCodes.VALIDATION, [{ path: "otherDeductions", message: "Las deducciones no pueden superar el devengado" }]);
    }
    await client.query(
      `UPDATE payroll_lines
          SET overtime = $2, bonuses = $3, transport = $4, other_deductions = $5,
              health = $6, pension = $7, gross = $8, deductions = $9, net = $10
        WHERE id = $1`,
      [lineId, values.overtime, values.bonuses, values.transport, values.otherDeductions, result.health, result.pension, result.gross, result.deductions, result.net],
    );
    await recomputePeriodTotals(client, periodId);
    return getPayrollPeriod(periodId, client);
  });
