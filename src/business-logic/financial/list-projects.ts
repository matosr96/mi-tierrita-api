import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toProjectSummary, type FinancialProjectRow, type ProjectScope, type ProjectSummaryResponse } from "../../models/index";
import { PROJECT_COLUMNS, PROJECT_FROM } from "./find-project";

/** Lista de proyectos del simulador: los del usuario (por omisión) o los de todos, del más reciente al más antiguo. */
export const listProjects = async (userId: number, scope: ProjectScope, page: PageRequest): Promise<PageResponse<ProjectSummaryResponse>> => {
  const where = scope === "mine" ? "WHERE p.user_id = $1" : "WHERE $1::bigint IS NOT NULL";
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${PROJECT_FROM} ${where}`, [userId]),
    db.query<FinancialProjectRow>(`SELECT ${PROJECT_COLUMNS} ${PROJECT_FROM} ${where} ORDER BY p.updated_at DESC, p.id DESC LIMIT $2 OFFSET $3`, [userId, page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map((r) => toProjectSummary(r)));
};
