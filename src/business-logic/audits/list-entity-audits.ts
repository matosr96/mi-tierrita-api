import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toAuditResponse, type AuditResponse, type AuditRow } from "../../models/index";
import { AUDIT_COLUMNS } from "./list-audits";

/** Línea de tiempo de un registro (brief 33): quién, cuándo, método y qué cambió, de lo más reciente a lo más antiguo. */
export const listEntityAudits = async (page: PageRequest, entity: string, entityId: number): Promise<PageResponse<AuditResponse>> => {
  const from = `FROM audits a JOIN users u ON u.id = a.user_id WHERE a.entity = $1 AND a.entity_id = $2`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${from}`, [entity, entityId]),
    db.query<AuditRow>(`SELECT ${AUDIT_COLUMNS} ${from} ORDER BY a.created_at DESC, a.id DESC LIMIT $3 OFFSET $4`, [entity, entityId, page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toAuditResponse));
};
