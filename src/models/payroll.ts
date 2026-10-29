import { createValidator } from "../common/validate";

/**
 * Nómina simplificada (migración 0015). No reemplaza la nómina electrónica de la DIAN ni calcula prestaciones
 * sociales ni aportes del empleador. Todo valor en pesos; los totales los calcula el servidor.
 */
export const PAY_FREQUENCIES = ["MONTHLY", "BIWEEKLY"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const PAYROLL_STATUSES = ["DRAFT", "APPROVED", "PAID"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/** Tope de los valores que se escriben a mano (DECIMAL(12,2) admite hasta 9.999.999.999,99). */
export const PAYROLL_AMOUNT_MAX = 999_999_999;

// ------------------------------------------------------------------ empleados

export type PayrollEmployeeRow = {
  id: number;
  firstName: string;
  lastName: string;
  documentId: string;
  position: string;
  baseSalary: number;
  payFrequency: PayFrequency;
  active: boolean;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollEmployeeResponse = Omit<PayrollEmployeeRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export const toPayrollEmployeeResponse = (row: PayrollEmployeeRow): PayrollEmployeeResponse => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type CreatePayrollEmployeeRequest = {
  firstName: string;
  lastName: string;
  documentId: string;
  position: string;
  baseSalary: number;
  payFrequency: PayFrequency;
  userId?: number | undefined;
};

const DOCUMENT_PATTERN = /^[0-9A-Za-z.-]+$/;

export const parseCreatePayrollEmployee = (body: unknown): CreatePayrollEmployeeRequest => {
  const v = createValidator(body);
  const firstName = v.string("firstName", { min: 1, max: 80 });
  const lastName = v.string("lastName", { min: 1, max: 80 });
  const documentId = v.string("documentId", { min: 3, max: 20, pattern: DOCUMENT_PATTERN, patternMessage: "Solo dígitos, letras, punto o guion" });
  const position = v.string("position", { min: 1, max: 80 });
  const baseSalary = v.number("baseSalary", { min: 1, max: PAYROLL_AMOUNT_MAX, decimals: 2 });
  const payFrequency = v.oneOf("payFrequency", PAY_FREQUENCIES);
  const userId = v.number("userId", { min: 1, integer: true }, false);
  v.done();
  return { firstName: firstName!, lastName: lastName!, documentId: documentId!, position: position!, baseSalary: baseSalary!, payFrequency: payFrequency!, userId };
};

/** `userId` acepta null explícito para desvincular la cuenta; ausente conserva la actual. `active` activa o desactiva. */
export type UpdatePayrollEmployeeRequest = {
  firstName?: string | undefined;
  lastName?: string | undefined;
  documentId?: string | undefined;
  position?: string | undefined;
  baseSalary?: number | undefined;
  payFrequency?: PayFrequency | undefined;
  active?: boolean | undefined;
  userId?: number | null | undefined;
};

export const parseUpdatePayrollEmployee = (body: unknown): UpdatePayrollEmployeeRequest => {
  const v = createValidator(body);
  const result: UpdatePayrollEmployeeRequest = {
    firstName: v.string("firstName", { min: 1, max: 80 }, false),
    lastName: v.string("lastName", { min: 1, max: 80 }, false),
    documentId: v.string("documentId", { min: 3, max: 20, pattern: DOCUMENT_PATTERN, patternMessage: "Solo dígitos, letras, punto o guion" }, false),
    position: v.string("position", { min: 1, max: 80 }, false),
    baseSalary: v.number("baseSalary", { min: 1, max: PAYROLL_AMOUNT_MAX, decimals: 2 }, false),
    payFrequency: v.oneOf("payFrequency", PAY_FREQUENCIES, false),
    active: v.boolean("active", false),
    userId: v.isNull("userId") ? null : v.number("userId", { min: 1, integer: true }, false),
  };
  if (v.issues().length === 0 && Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};

export type PayrollEmployeeQuery = { active?: boolean | undefined; frequency?: PayFrequency | undefined };

// ------------------------------------------------------------------ periodos

export type PayrollPerson = { id: number; firstName: string; lastName: string };

export type PayrollPeriodRow = {
  id: number;
  frequency: PayFrequency;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollStatus;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  createdBy: PayrollPerson;
  approvedBy: PayrollPerson | null;
  paidBy: PayrollPerson | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
};

/** `editable` lo decide el servidor (solo un borrador se edita o se elimina). */
export type PayrollPeriodResponse = Omit<PayrollPeriodRow, "approvedAt" | "paidAt" | "createdAt"> & {
  editable: boolean;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PayrollLineResponse = {
  id: number;
  employeeId: number;
  employee: { firstName: string; lastName: string; documentId: string; position: string };
  base: number;
  overtime: number;
  bonuses: number;
  transport: number;
  health: number;
  pension: number;
  otherDeductions: number;
  gross: number;
  deductions: number;
  net: number;
};

export type PayrollPeriodDetailResponse = PayrollPeriodResponse & { lines: PayrollLineResponse[] };

export const toPayrollPeriodResponse = (row: PayrollPeriodRow): PayrollPeriodResponse => ({
  ...row,
  editable: row.status === "DRAFT",
  approvedAt: row.approvedAt?.toISOString() ?? null,
  paidAt: row.paidAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export type CreatePayrollPeriodRequest = { frequency: PayFrequency; periodStart: string; periodEnd: string; payDate: string };

export const parseCreatePayrollPeriod = (body: unknown): CreatePayrollPeriodRequest => {
  const v = createValidator(body);
  const frequency = v.oneOf("frequency", PAY_FREQUENCIES);
  const periodStart = v.date("periodStart");
  const periodEnd = v.date("periodEnd");
  const payDate = v.date("payDate");
  // Fechas ISO del mismo formato: se comparan como texto.
  if (periodStart !== undefined && periodEnd !== undefined && periodEnd < periodStart) v.custom("periodEnd", "Debe ser igual o posterior al inicio del periodo");
  v.done();
  return { frequency: frequency!, periodStart: periodStart!, periodEnd: periodEnd!, payDate: payDate! };
};

/** Lo único editable de una línea: lo que escribe la persona. Salud, pensión y totales los recalcula el servidor. */
export type UpdatePayrollLineRequest = {
  overtime?: number | undefined;
  bonuses?: number | undefined;
  transport?: number | undefined;
  otherDeductions?: number | undefined;
};

export const parseUpdatePayrollLine = (body: unknown): UpdatePayrollLineRequest => {
  const v = createValidator(body);
  const rule = { min: 0, max: PAYROLL_AMOUNT_MAX, decimals: 2 };
  const result: UpdatePayrollLineRequest = {
    overtime: v.number("overtime", rule, false),
    bonuses: v.number("bonuses", rule, false),
    transport: v.number("transport", rule, false),
    otherDeductions: v.number("otherDeductions", rule, false),
  };
  if (v.issues().length === 0 && Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un valor a modificar");
  v.done();
  return result;
};

export type PayrollPeriodQuery = { status?: PayrollStatus | undefined; year?: number | undefined };

/** Filtros del listado de periodos: un valor inválido se ignora, como en el resto de la API. */
export const parsePayrollPeriodQuery = (query: Record<string, unknown>): PayrollPeriodQuery => {
  const status = query["status"];
  const yearRaw = query["year"];
  const year = typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
  return {
    status: typeof status === "string" && (PAYROLL_STATUSES as readonly string[]).includes(status) ? (status as PayrollStatus) : undefined,
    year: year !== undefined && year >= 2000 && year <= 2100 ? year : undefined,
  };
};

export const parsePayrollEmployeeQuery = (query: Record<string, unknown>): PayrollEmployeeQuery => {
  const active = query["active"];
  const frequency = query["frequency"];
  return {
    active: active === "true" ? true : active === "false" ? false : undefined,
    frequency: typeof frequency === "string" && (PAY_FREQUENCIES as readonly string[]).includes(frequency) ? (frequency as PayFrequency) : undefined,
  };
};

/** Lo que el calendario y los avisos necesitan de cada periodo sin pagar (ver `listUpcomingPayroll`). */
export type UpcomingPayroll = {
  id: number;
  frequency: PayFrequency;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: Exclude<PayrollStatus, "PAID">;
  totalNet: number;
};
