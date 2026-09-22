import { db } from "../../data-sources/index";
import type { AmortizationRow } from "./engine";
import { requireScenario } from "./find-scenario";

export type AmortizationResponse = {
  scenarioId: number;
  credit: number;
  termMonths: number;
  installment: number;
  totalInterest: number;
  rows: AmortizationRow[];
};

/** CU-16 / RF-06.4 Tabla de amortización mes a mes desde el detalle desnormalizado. */
export const getScenarioAmortization = async (id: number): Promise<AmortizationResponse> => {
  const scenario = await requireScenario(id);
  const { rows } = await db.query<AmortizationRow>(
    `SELECT month, installment, interest, principal, balance
     FROM financial_scenario_amortization WHERE scenario_id = $1 ORDER BY month`,
    [id],
  );
  return {
    scenarioId: id,
    credit: scenario.results.credit,
    termMonths: scenario.termMonths,
    installment: scenario.results.installment,
    totalInterest: scenario.results.totalInterest,
    rows,
  };
};
