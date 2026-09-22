import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAuditResponse, type AuditListFilter, type AuditResponse, type AuditRow } from "../../models/index";

/** CU-18 / RF-07.2: historial de escrituras con filtros por usuario, recurso y rango de fechas. */
export const listAudits = async (page: PageRequest, filter: AuditListFilter): Promise<PageResponse<AuditResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    conditions.push(`a.user_id = $${params.length}`);
  }
  if (filter.resource !== undefined) {
    params.push(`%${filter.resource}%`);
    conditions.push(`a.resource ILIKE $${params.length}`);
  }
  if (filter.from !== undefined) {
    params.push(filter.from);
    conditions.push(`a.created_at >= $${params.length}::date`);
  }
  if (filter.to !== undefined) {
    params.push(filter.to);
    conditions.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const from = `FROM audits a JOIN users u ON u.id = a.user_id`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${from} ${where}`, params),
    db.query<AuditRow>(
      `SELECT a.id, a.user_id AS "userId", u.username, a.method, a.resource, a.created_at AS "createdAt"
       ${from} ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toAuditResponse));
};
