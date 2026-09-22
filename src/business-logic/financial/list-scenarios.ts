import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toScenarioSummary, type FinancialScenarioRow, type ScenarioSummaryResponse } from "../../models/index";
import { SCENARIO_COLUMNS, SCENARIO_FROM } from "./find-scenario";

export const listScenarios = async (page: PageRequest): Promise<PageResponse<ScenarioSummaryResponse>> => {
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM financial_scenarios`),
    db.query<FinancialScenarioRow>(`SELECT ${SCENARIO_COLUMNS} ${SCENARIO_FROM} ORDER BY f.created_at DESC, f.id DESC LIMIT $1 OFFSET $2`, [page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toScenarioSummary));
};
