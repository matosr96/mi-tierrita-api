import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toReportExportResponse, type CreateReportExportRequest, type ReportExportResponse, type ReportExportRow } from "../../models/index";
import { Roles, type Role } from "../../security/index";
import { EXPORT_COLUMNS } from "./list-exports";

/**
 * Historial de reportes (prototipo 09): registra que alguien descargó un reporte en PDF o Excel.
 * La secretaria solo tiene acceso al reporte de ventas, así que solo puede registrar ese.
 */
export const recordExport = async (userId: number, role: Role, input: CreateReportExportRequest): Promise<ReportExportResponse> => {
  if (role !== Roles.ADMIN && input.report !== "sales") throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const { rows } = await db.query<ReportExportRow>(
    `WITH e AS (INSERT INTO report_exports (user_id, report, format, description) VALUES ($1, $2, $3, $4) RETURNING *)
     SELECT ${EXPORT_COLUMNS} FROM e JOIN users u ON u.id = e.user_id`,
    [userId, input.report, input.format, input.description],
  );
  const row = rows[0];
  if (row === undefined) throw new Error("INSERT de exportación no devolvió fila");
  return toReportExportResponse(row);
};
