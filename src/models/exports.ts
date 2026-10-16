import { createValidator } from "../common/validate";

/** Historial de reportes descargados (prototipo 09). */
export const EXPORT_REPORTS = ["sales", "inventory", "receivables", "scenario"] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];
export const EXPORT_FORMATS = ["pdf", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ReportExportRow = { id: number; userId: number; username: string; report: ExportReport; format: ExportFormat; description: string; createdAt: Date };

export type ReportExportResponse = Omit<ReportExportRow, "createdAt"> & { createdAt: string };

export const toReportExportResponse = (row: ReportExportRow): ReportExportResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type CreateReportExportRequest = { report: ExportReport; format: ExportFormat; description: string };

export const parseCreateReportExport = (body: unknown): CreateReportExportRequest => {
  const v = createValidator(body);
  const report = v.oneOf("report", EXPORT_REPORTS);
  const format = v.oneOf("format", EXPORT_FORMATS);
  const description = v.string("description", { min: 1, max: 200 });
  v.done();
  return { report: report!, format: format!, description: description! };
};
