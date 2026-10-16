import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toReportExportResponse, type ReportExportResponse, type ReportExportRow } from "../../models/index";

export const EXPORT_COLUMNS = `e.id, e.user_id AS "userId", u.username, e.report, e.format, e.description, e.created_at AS "createdAt"`;

/** Historial de reportes generados, del más reciente al más antiguo. `userId` limita a los de una persona. */
export const listExports = async (page: PageRequest, filter: { userId?: number | undefined }): Promise<PageResponse<ReportExportResponse>> => {
  const filterParams: unknown[] = filter.userId === undefined ? [] : [filter.userId];
  const where = filter.userId === undefined ? "" : "WHERE e.user_id = $1";
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM report_exports e ${where}`, filterParams),
    db.query<ReportExportRow>(
      `SELECT ${EXPORT_COLUMNS} FROM report_exports e JOIN users u ON u.id = e.user_id ${where}
       ORDER BY e.created_at DESC, e.id DESC LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toReportExportResponse));
};
