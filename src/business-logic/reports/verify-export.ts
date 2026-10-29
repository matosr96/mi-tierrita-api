import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ExportVerification, ReportExportRow } from "../../models/index";
import { EXPORT_COLUMNS } from "./list-exports";

/**
 * Verificación pública de un documento por su folio (el QR de la portada): devuelve solo los datos de emisión.
 * Un folio que no existe responde 680.
 */
export const verifyExport = async (folio: string): Promise<ExportVerification> => {
  const { rows } = await db.query<ReportExportRow>(`SELECT ${EXPORT_COLUMNS} FROM report_exports e JOIN users u ON u.id = e.user_id WHERE e.folio = $1`, [folio]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.REPORT_EXPORT_NOT_FOUND);
  return {
    valid: true,
    folio: row.folio,
    report: row.report,
    format: row.format,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    generatedBy: row.username,
    filters: row.filters,
    summary: row.summary,
    hash: row.hash,
  };
};
