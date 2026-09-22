import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import type { FinancialScenarioRow } from "../../models/index";

export const SCENARIO_COLUMNS = `
  f.id, f.name, f.user_id AS "userId", u.username,
  f.fixed_investment AS "fixedInvestment", f.credit_pct AS "creditPct", f.term_months AS "termMonths",
  f.sales_increase_pct AS "salesIncreasePct", f.additional_expenses_month AS "additionalExpensesMonth",
  f.credit_covers_working_capital AS "creditCoversWorkingCapital",
  f.base_assumptions AS "baseAssumptions", f.results,
  f.created_at AS "createdAt", f.updated_at AS "updatedAt"`;

export const SCENARIO_FROM = `FROM financial_scenarios f JOIN users u ON u.id = f.user_id`;

export const findScenarioById = async (id: number, q: Queryable = db): Promise<FinancialScenarioRow | undefined> => {
  const { rows } = await q.query<FinancialScenarioRow>(`SELECT ${SCENARIO_COLUMNS} ${SCENARIO_FROM} WHERE f.id = $1`, [id]);
  return rows[0];
};

export const requireScenario = async (id: number): Promise<FinancialScenarioRow> => {
  const scenario = await findScenarioById(id);
  if (scenario === undefined) throw domainError(ErrorCodes.SCENARIO_NOT_FOUND);
  return scenario;
};
