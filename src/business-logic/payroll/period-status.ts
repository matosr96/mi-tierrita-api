import type { PayrollStatus } from "../../models/index";

/**
 * Ciclo de un periodo de nómina: DRAFT (borrador) → APPROVED (aprobado) → PAID (pagado). Funciones puras.
 * Solo un borrador se edita (líneas) o se elimina; solo un borrador se aprueba y solo uno aprobado se paga.
 */
export const isPeriodEditable = (status: PayrollStatus): boolean => status === "DRAFT";
export const canApprovePeriod = (status: PayrollStatus): boolean => status === "DRAFT";
export const canPayPeriod = (status: PayrollStatus): boolean => status === "APPROVED";
