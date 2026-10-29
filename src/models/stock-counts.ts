import { createValidator, isIsoDate } from "../common/validate";
import { ErrorCodes, domainError } from "../common/errors";

/** Conteos de inventario: estados del flujo Programar → Iniciar → Registrar → Enviar → Aplicar (o Cancelar). */
export const StockCountStatuses = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  APPLIED: "APPLIED",
  CANCELLED: "CANCELLED",
} as const;
export type StockCountStatus = (typeof StockCountStatuses)[keyof typeof StockCountStatuses];
export const ALL_STOCK_COUNT_STATUSES = [
  StockCountStatuses.PLANNED,
  StockCountStatuses.IN_PROGRESS,
  StockCountStatuses.SUBMITTED,
  StockCountStatuses.APPLIED,
  StockCountStatuses.CANCELLED,
] as const;

export const StockCountScopes = { ALL: "ALL", CATEGORY: "CATEGORY" } as const;
export type StockCountScope = (typeof StockCountScopes)[keyof typeof StockCountScopes];
export const ALL_STOCK_COUNT_SCOPES = [StockCountScopes.ALL, StockCountScopes.CATEGORY] as const;

/** Qué tan cerca está la fecha programada de un conteo abierto (PLANNED o IN_PROGRESS); null si ya se envió o cerró. */
export type StockCountDue = "OVERDUE" | "TODAY" | "UPCOMING" | null;

export type StockCountRow = {
  id: number;
  title: string;
  scheduledDate: string;
  scope: StockCountScope;
  categoryId: number | null;
  categoryName: string | null;
  status: StockCountStatus;
  note: string | null;
  createdBy: number;
  createdByName: string;
  startedAt: Date | null;
  startedBy: number | null;
  startedByName: string | null;
  submittedAt: Date | null;
  submittedBy: number | null;
  submittedByName: string | null;
  appliedAt: Date | null;
  appliedBy: number | null;
  appliedByName: string | null;
  cancelledAt: Date | null;
  cancelledBy: number | null;
  cancelledByName: string | null;
  createdAt: Date;
  totalLines: number;
  countedLines: number;
};

type Dated = "startedAt" | "submittedAt" | "appliedAt" | "cancelledAt" | "createdAt";

export type StockCountResponse = Omit<StockCountRow, Dated> & {
  startedAt: string | null;
  submittedAt: string | null;
  appliedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  due: StockCountDue;
};

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

/** Conteo abierto con fecha pasada → OVERDUE; de hoy → TODAY; futura → UPCOMING. Enviado, aplicado o cancelado → null. */
export const stockCountDue = (status: StockCountStatus, scheduledDate: string, today: string): StockCountDue => {
  if (status !== StockCountStatuses.PLANNED && status !== StockCountStatuses.IN_PROGRESS) return null;
  if (scheduledDate < today) return "OVERDUE";
  return scheduledDate === today ? "TODAY" : "UPCOMING";
};

export const toStockCountResponse = (row: StockCountRow, today: string): StockCountResponse => ({
  ...row,
  startedAt: iso(row.startedAt),
  submittedAt: iso(row.submittedAt),
  appliedAt: iso(row.appliedAt),
  cancelledAt: iso(row.cancelledAt),
  createdAt: row.createdAt.toISOString(),
  due: stockCountDue(row.status, row.scheduledDate, today),
});

export type StockCountLineResponse = {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  categoryName: string;
  /** Stock físico del sistema al iniciar el conteo. */
  expectedQuantity: number;
  countedQuantity: number | null;
  /** countedQuantity − expectedQuantity (null mientras no se cuente). */
  difference: number | null;
  /** Diferencia contra el stock actual con la que se aplicó el ajuste (solo en APPLIED). */
  appliedDifference: number | null;
  note: string | null;
};

export type StockCountSummary = {
  totalLines: number;
  countedLines: number;
  pendingLines: number;
  linesWithDifference: number;
  shortageUnits: number;
  surplusUnits: number;
};

export type StockCountDetailResponse = StockCountResponse & { lines: StockCountLineResponse[]; summary: StockCountSummary };

/** Lote que el ajuste descontaría (faltante) — vencidos primero, luego el que vence antes. */
export type ShortageDeduction = { productBatchId: number; expiresAt: string; expired: boolean; quantity: number };

export type AdjustmentPreviewLine = {
  productId: number;
  productName: string;
  sku: string;
  expectedQuantity: number;
  countedQuantity: number;
  /** Stock físico actual del producto (puede haber cambiado desde que se inició el conteo). */
  currentStock: number;
  /** countedQuantity − currentStock: lo que se aplicaría ahora. */
  difference: number;
  kind: "SHORTAGE" | "SURPLUS";
  stockChangedSinceStart: boolean;
  /** Faltante: de qué lotes saldrían las unidades. */
  deductions: ShortageDeduction[];
  /** Faltante mayor que lo que hay en lotes (no debería pasar si el stock está cuadrado). */
  exceedsStock: boolean;
  /** Sobrante: costo unitario que llevaría el lote de ajuste (último costo conocido; null = precio de compra vigente). */
  lastUnitCost: number | null;
  /** Sobrante: exige `expiresAt` en la petición de aplicar. */
  needsExpiry: boolean;
};

export type AdjustmentPreviewResponse = {
  countId: number;
  status: StockCountStatus;
  lines: AdjustmentPreviewLine[];
  summary: { shortageLines: number; surplusLines: number; shortageUnits: number; surplusUnits: number; unchangedLines: number; changedSinceStart: number };
};

export type AppliedAdjustment = {
  productId: number;
  productName: string;
  sku: string;
  difference: number;
  batches: { productBatchId: number; quantity: number }[];
};

export type ApplyStockCountResponse = StockCountDetailResponse & { adjustments: AppliedAdjustment[] };

// ---------------------------------------------------------------- entrada

const TITLE_RULE = { min: 1, max: 120 };
const NOTE_RULE = { max: 400 };
const QUANTITY_RULE = { integer: true, min: 0, max: 1_000_000 };

export type CreateStockCountRequest = {
  title: string;
  scheduledDate: string;
  scope: StockCountScope;
  categoryId: number | null;
  note: string | null;
};

export const parseCreateStockCount = (body: unknown): CreateStockCountRequest => {
  const v = createValidator(body);
  const title = v.string("title", TITLE_RULE);
  const scheduledDate = v.date("scheduledDate");
  const scope = v.oneOf("scope", ALL_STOCK_COUNT_SCOPES, false) ?? StockCountScopes.ALL;
  const categoryId = v.number("categoryId", { integer: true, min: 1 }, false);
  const note = v.string("note", NOTE_RULE, false);
  if (scope === StockCountScopes.CATEGORY && categoryId === undefined && !v.issues().some((i) => i.path === "categoryId")) {
    v.custom("categoryId", "Obligatorio cuando el alcance es una categoría");
  }
  v.done();
  return {
    title: title!,
    scheduledDate: scheduledDate!,
    scope,
    categoryId: scope === StockCountScopes.CATEGORY ? categoryId! : null,
    note: note === undefined || note === "" ? null : note,
  };
};

export type UpdateStockCountRequest = { title?: string | undefined; scheduledDate?: string | undefined; note?: string | null | undefined };

/** Solo título, fecha y nota (alcance fijo una vez programado). `note: null` o "" la borra. */
export const parseUpdateStockCount = (body: unknown): UpdateStockCountRequest => {
  const v = createValidator(body);
  const title = v.string("title", TITLE_RULE, false);
  const scheduledDate = v.date("scheduledDate", false);
  const note = v.isNull("note") ? null : v.string("note", NOTE_RULE, false);
  const result: UpdateStockCountRequest = { title, scheduledDate, note: note === "" ? null : note };
  if (!v.has("title") && !v.has("scheduledDate") && !v.has("note")) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};

export type StockCountLineInput = { productId: number; countedQuantity: number | null; note?: string | null | undefined };
export type SaveStockCountLinesRequest = { lines: StockCountLineInput[] };

/** Avance del conteo: `countedQuantity: null` deja la línea sin contar; `note` ausente no la toca, null o "" la borra. */
export const parseSaveStockCountLines = (body: unknown): SaveStockCountLinesRequest => {
  const v = createValidator(body);
  const lines = v.array<StockCountLineInput>("lines", { min: 1, max: 2000 }, (item) => {
    const productId = item.number("productId", { integer: true, min: 1 });
    let countedQuantity: number | null | undefined;
    if (item.isNull("countedQuantity")) countedQuantity = null;
    else countedQuantity = item.number("countedQuantity", QUANTITY_RULE);
    let note: string | null | undefined;
    if (item.has("note")) note = item.isNull("note") ? null : item.string("note", { max: 200 }, false);
    if (note === "") note = null;
    if (productId === undefined || countedQuantity === undefined) return undefined;
    return note === undefined ? { productId, countedQuantity } : { productId, countedQuantity, note };
  });
  if (lines !== undefined) {
    const seen = new Set<number>();
    lines.forEach((line, index) => {
      if (seen.has(line.productId)) v.custom(`lines[${index}].productId`, "Producto repetido en la lista");
      seen.add(line.productId);
    });
  }
  v.done();
  return { lines: lines! };
};

export type ApplyStockCountRequest = { surplusLots: { productId: number; expiresAt: string }[] };

/** Fecha de vencimiento del lote de ajuste de cada producto con sobrante. */
export const parseApplyStockCount = (body: unknown): ApplyStockCountRequest => {
  const v = createValidator(body ?? {});
  const surplusLots =
    v.array<{ productId: number; expiresAt: string }>("surplusLots", { max: 2000 }, (item) => {
      const productId = item.number("productId", { integer: true, min: 1 });
      const expiresAt = item.date("expiresAt");
      return productId === undefined || expiresAt === undefined ? undefined : { productId, expiresAt };
    }, false) ?? [];
  const seen = new Set<number>();
  surplusLots.forEach((lot, index) => {
    if (seen.has(lot.productId)) v.custom(`surplusLots[${index}].productId`, "Producto repetido en la lista");
    seen.add(lot.productId);
  });
  v.done();
  return { surplusLots };
};

export type StockCountListFilter = {
  status?: StockCountStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

/** ?status=&from=&to= del listado. Un estado desconocido o una fecha mal escrita responden 400. */
export const parseStockCountListFilter = (query: Record<string, unknown>): StockCountListFilter => {
  const issues: { path: string; message: string }[] = [];
  const read = (name: string): string | undefined => {
    const raw = query[name];
    if (raw === undefined || raw === "") return undefined;
    if (typeof raw !== "string") {
      issues.push({ path: name, message: "Valor inválido" });
      return undefined;
    }
    return raw;
  };
  const status = read("status");
  const from = read("from");
  const to = read("to");
  if (status !== undefined && !(ALL_STOCK_COUNT_STATUSES as readonly string[]).includes(status)) {
    issues.push({ path: "status", message: `Debe ser uno de: ${ALL_STOCK_COUNT_STATUSES.join(", ")}` });
  }
  if (from !== undefined && !isIsoDate(from)) issues.push({ path: "from", message: "Formato esperado YYYY-MM-DD" });
  if (to !== undefined && !isIsoDate(to)) issues.push({ path: "to", message: "Formato esperado YYYY-MM-DD" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  return { status: status as StockCountStatus | undefined, from, to };
};

/** Conteo pendiente para el calendario y los avisos (ver business-logic/stock-counts/list-scheduled-counts.ts). */
export type ScheduledCount = {
  id: number;
  title: string;
  scheduledDate: string;
  status: "PLANNED" | "IN_PROGRESS";
  scope: StockCountScope;
  categoryId: number | null;
  categoryName: string | null;
  /** scheduledDate anterior a hoy (hora del negocio). */
  overdue: boolean;
};
