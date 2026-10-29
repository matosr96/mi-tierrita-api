import { ErrorCodes, domainError } from "../common/errors";
import { createValidator } from "../common/validate";

/** Historial de reportes descargados (prototipo 09) con folio, hash y filtros (brief 2.4, puntos 25 y 26). */
export const EXPORT_REPORTS = ["sales", "inventory", "receivables", "scenario"] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];
export const EXPORT_FORMATS = ["pdf", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Valores que admiten `filters` y `summary`: solo escalares, para que el hash sea reproducible y el historial legible. */
export type ExportScalar = string | number | boolean | null;
export type ExportData = Record<string, ExportScalar>;

export type ReportExportRow = {
  id: number;
  userId: number;
  username: string;
  report: ExportReport;
  format: ExportFormat;
  description: string;
  folio: string;
  /** sha256 en hexadecimal; null en los registros anteriores a la migración 0010. */
  hash: string | null;
  filters: ExportData;
  summary: ExportData;
  createdAt: Date;
};

export type ReportExportResponse = Omit<ReportExportRow, "createdAt"> & { createdAt: string; verifyUrl: string };

/** Ruta pública de verificación (relativa a la API); la app arma la suya con `/verificar/:folio`. */
export const verifyPath = (folio: string): string => `/reports/verify/${folio}`;

export const toReportExportResponse = (row: ReportExportRow): ReportExportResponse => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  verifyUrl: verifyPath(row.folio),
});

/** Lo que ve cualquier persona que escanea el QR: nada más que los datos de emisión. */
export type ExportVerification = {
  valid: true;
  folio: string;
  report: ExportReport;
  format: ExportFormat;
  description: string;
  createdAt: string;
  generatedBy: string;
  filters: ExportData;
  summary: ExportData;
  hash: string | null;
};

export type CreateReportExportRequest = { report: ExportReport; format: ExportFormat; description: string; filters: ExportData; summary: ExportData };

const MAX_KEYS = 24;
const MAX_KEY = 40;
const MAX_TEXT = 200;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Objeto plano de escalares (opcional; vacío si no viene). Acumula los problemas en el validador del cuerpo. */
const parseData = (v: ReturnType<typeof createValidator>, body: unknown, field: "filters" | "summary"): ExportData => {
  const raw = isPlainObject(body) ? body[field] : undefined;
  if (raw === undefined || raw === null) return {};
  if (!isPlainObject(raw)) {
    v.custom(field, "Debe ser un objeto");
    return {};
  }
  const keys = Object.keys(raw);
  if (keys.length > MAX_KEYS) {
    v.custom(field, `Máximo ${MAX_KEYS} campos`);
    return {};
  }
  const out: ExportData = {};
  for (const key of keys) {
    const value = raw[key];
    if (key.length === 0 || key.length > MAX_KEY) {
      v.custom(`${field}.${key.slice(0, MAX_KEY)}`, `Nombre de máximo ${MAX_KEY} caracteres`);
      continue;
    }
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) out[key] = value;
    else if (typeof value === "string" && value.length <= MAX_TEXT) out[key] = value;
    else v.custom(`${field}.${key}`, `Debe ser texto (máximo ${MAX_TEXT} caracteres), número, booleano o null`);
  }
  return out;
};

export const parseCreateReportExport = (body: unknown): CreateReportExportRequest => {
  const v = createValidator(body);
  const report = v.oneOf("report", EXPORT_REPORTS);
  const format = v.oneOf("format", EXPORT_FORMATS);
  const description = v.string("description", { min: 1, max: 200 });
  const filters = parseData(v, body, "filters");
  const summary = parseData(v, body, "summary");
  v.done();
  return { report: report!, format: format!, description: description!, filters, summary };
};

export const FOLIO_PATTERN = /^R-\d{4}-\d{6}$/;

/** Folio de la ruta pública (`R-AAAA-NNNNNN`); cualquier otra forma responde 400 sin consultar la base. */
export const parseFolio = (raw: string | string[] | undefined): string => {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!FOLIO_PATTERN.test(value)) throw domainError(ErrorCodes.VALIDATION, [{ path: "folio", message: "Formato esperado R-AAAA-NNNNNN" }]);
  return value;
};
