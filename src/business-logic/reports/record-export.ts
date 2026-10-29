import { createHash } from "node:crypto";
import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toReportExportResponse, type CreateReportExportRequest, type ExportData, type ReportExportResponse, type ReportExportRow } from "../../models/index";
import { Roles, type Role } from "../../security/index";
import { EXPORT_COLUMNS } from "./list-exports";

/** Folio legible del documento: `R-AAAA-NNNNNN` (año de emisión y consecutivo de la secuencia). */
export const nextFolio = (year: number, seq: number): string => `R-${year}-${String(seq).padStart(6, "0")}`;

/** Serialización estable de un objeto plano (claves ordenadas) para que el hash no dependa del orden de llegada. */
const canonical = (data: ExportData): string =>
  JSON.stringify(
    Object.keys(data)
      .sort()
      .reduce<ExportData>((acc, k) => {
        acc[k] = data[k] as ExportData[string];
        return acc;
      }, {}),
  );

/** sha256 (hex) de `report|format|filters|summary|createdAt|userId`: lo que el QR permite comprobar. Determinista. */
export const exportHash = (input: { report: string; format: string; filters: ExportData; summary: ExportData; createdAt: string; userId: number }): string =>
  createHash("sha256").update([input.report, input.format, canonical(input.filters), canonical(input.summary), input.createdAt, String(input.userId)].join("|")).digest("hex");

/** Año de emisión en la zona horaria del negocio (America/Bogota), el mismo criterio que `todayIso`. */
const businessYear = (date: Date): number => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", year: "numeric" }).format(date));

/**
 * Historial de reportes (prototipo 09 + brief 2.4): registra que alguien generó un reporte en PDF o Excel, con sus
 * filtros y resumen, y le asigna folio y hash. La secretaria solo tiene acceso al reporte de ventas, así que solo
 * puede registrar ese.
 */
export const recordExport = async (userId: number, role: Role, input: CreateReportExportRequest): Promise<ReportExportResponse> => {
  if (role !== Roles.ADMIN && input.report !== "sales") throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const now = new Date();
  const createdAt = now.toISOString();
  const { rows: seqRows } = await db.query<{ seq: number }>(`SELECT nextval('report_exports_folio_seq')::int AS seq`);
  const folio = nextFolio(businessYear(now), seqRows[0]?.seq ?? 0);
  const hash = exportHash({ report: input.report, format: input.format, filters: input.filters, summary: input.summary, createdAt, userId });
  const { rows } = await db.query<ReportExportRow>(
    `WITH e AS (
       INSERT INTO report_exports (user_id, report, format, description, folio, hash, filters, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz) RETURNING *)
     SELECT ${EXPORT_COLUMNS} FROM e JOIN users u ON u.id = e.user_id`,
    [userId, input.report, input.format, input.description, folio, hash, JSON.stringify(input.filters), JSON.stringify(input.summary), createdAt],
  );
  const row = rows[0];
  if (row === undefined) throw new Error("INSERT de exportación no devolvió fila");
  return toReportExportResponse(row);
};
