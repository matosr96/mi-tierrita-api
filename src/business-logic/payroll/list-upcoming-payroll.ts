import { db, type Queryable } from "../../data-sources/index";
import type { UpcomingPayroll } from "../../models/index";

/**
 * Periodos de nómina sin pagar (DRAFT o APPROVED) con fecha de pago hasta `untilDate` inclusive, también los que ya
 * pasaron de su fecha sin pagarse; los más próximos primero. Para el calendario y los avisos (los integra la sesión
 * principal; esta función no decide prioridades ni textos).
 *
 * @param untilDate fecha YYYY-MM-DD en la zona del negocio (por ejemplo `addDaysIso(todayIso(), 7)`).
 * @returns `UpcomingPayroll[]`:
 *   `{ id: number; frequency: "MONTHLY" | "BIWEEKLY"; periodStart: "YYYY-MM-DD"; periodEnd: "YYYY-MM-DD";
 *      payDate: "YYYY-MM-DD"; status: "DRAFT" | "APPROVED"; totalNet: number }` ordenado por `payDate`, `id`.
 *   `totalNet` es el neto total a pagar del periodo en pesos enteros, calculado por el servidor.
 */
export const listUpcomingPayroll = async (untilDate: string, q: Queryable = db): Promise<UpcomingPayroll[]> => {
  const { rows } = await q.query<UpcomingPayroll>(
    `SELECT id, frequency, period_start AS "periodStart", period_end AS "periodEnd", pay_date AS "payDate", status, total_net AS "totalNet"
       FROM payroll_periods
      WHERE status <> 'PAID' AND pay_date <= $1::date
      ORDER BY pay_date, id`,
    [untilDate],
  );
  return rows;
};
