import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toScenarioSummary, type FinancialScenarioRow, type ScenarioSummaryResponse } from "../../models/index";
import { SCENARIO_COLUMNS, SCENARIO_FROM } from "./find-scenario";

/** CU-15 Comparar escenarios lado a lado (Tabla 7). Un id inexistente responde 607. */
export const compareScenarios = async (ids: number[]): Promise<{ scenarios: ScenarioSummaryResponse[] }> => {
  const { rows } = await db.query<FinancialScenarioRow>(`SELECT ${SCENARIO_COLUMNS} ${SCENARIO_FROM} WHERE f.id = ANY($1::bigint[])`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) throw domainError(ErrorCodes.SCENARIO_NOT_FOUND, { missing });
  return { scenarios: ids.map((id) => toScenarioSummary(byId.get(id)!)) };
};
