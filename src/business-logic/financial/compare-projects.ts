import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toProjectSummary, type FinancialProjectRow, type ProjectSummaryResponse } from "../../models/index";
import { simulate, type ScenarioRow } from "./simulator";
import { PROJECT_COLUMNS, PROJECT_FROM } from "./find-project";

export type ProjectComparison = ProjectSummaryResponse & { scenarios: ScenarioRow[] };

/** Compara proyectos lado a lado, cada uno con sus escenarios pesimista, base y optimista. Un id inexistente responde 715. */
export const compareProjects = async (ids: number[]): Promise<{ projects: ProjectComparison[] }> => {
  const { rows } = await db.query<FinancialProjectRow>(`SELECT ${PROJECT_COLUMNS} ${PROJECT_FROM} WHERE p.id = ANY($1::bigint[])`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) throw domainError(ErrorCodes.FINANCIAL_PROJECT_NOT_FOUND, { missing });
  return {
    projects: ids.map((id) => {
      const row = byId.get(id)!;
      const result = simulate(row.input);
      return { ...toProjectSummary(row, result), scenarios: result.scenarios };
    }),
  };
};
