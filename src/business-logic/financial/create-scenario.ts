import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toScenarioDetail, type CreateScenarioRequest, type ScenarioDetailResponse } from "../../models/index";
import { calculateScenario } from "./engine";
import { findScenarioById } from "./find-scenario";

/**
 * CU-14 Registrar escenario: calcula con el motor (RF-06.2) y persiste supuestos y resultado
 * (RF-06.8), más el detalle desnormalizado de flujos y amortización para consultas por año/mes.
 */
export const createScenario = async (userId: number, request: CreateScenarioRequest): Promise<ScenarioDetailResponse> => {
  const { input } = request;
  const result = calculateScenario(input);
  if (!Number.isFinite(result.npv)) throw domainError(ErrorCodes.INVALID_SCENARIO);

  const id = await db.transaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO financial_scenarios
         (name, user_id, fixed_investment, credit_pct, term_months, sales_increase_pct,
          additional_expenses_month, credit_covers_working_capital, base_assumptions, results)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       RETURNING id`,
      [
        request.name,
        userId,
        input.fixedInvestment,
        input.creditPct,
        input.termMonths,
        input.salesIncrease,
        input.additionalExpensesMonth,
        input.creditCoversWorkingCapital,
        JSON.stringify(input.assumptions),
        JSON.stringify(result),
      ],
    );
    const scenarioId = rows[0]?.id;
    if (scenarioId === undefined) throw new Error("INSERT de escenario no devolvió id");

    for (let year = 0; year < result.flows.length; year++) {
      const d = result.detail[year - 1];
      await client.query(
        `INSERT INTO financial_scenario_cash_flows
           (scenario_id, year, margin, expenses, working_capital_delta, salvage, working_capital_recovery, net_flow, investor_flow)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [scenarioId, year, d?.margin ?? 0, d?.expenses ?? 0, d?.workingCapitalDelta ?? 0, d?.salvage ?? 0, d?.workingCapitalRecovery ?? 0, result.flows[year] ?? 0, result.investorFlows[year] ?? 0],
      );
    }
    for (const row of result.amortization) {
      await client.query(
        `INSERT INTO financial_scenario_amortization (scenario_id, month, installment, interest, principal, balance)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [scenarioId, row.month, row.installment, row.interest, row.principal, row.balance],
      );
    }
    return scenarioId;
  });

  const created = await findScenarioById(id);
  if (created === undefined) throw new Error("Escenario recién creado no encontrado");
  return toScenarioDetail(created);
};
