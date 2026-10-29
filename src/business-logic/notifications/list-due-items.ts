import { todayIso } from "../../common/index";
import type { DueNoticesResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { listExpiringBatches } from "../batches/list-expiring-batches";
import { DEFAULT_OVERDUE_DAYS } from "../customers/get-customer-balance";
import { receivablesReport } from "../reports/receivables-report";
import { DUE_BATCH_DAYS, classifyDue, seesBatches, seesReceivables, summarizeDue } from "./due-items";

const WINDOW = { page: 1, limit: 100, offset: 0 };

/**
 * Avisos de vencimiento de una persona según su rol (brief 2026, punto 13). Reutiliza las consultas de lotes por
 * vencer y del reporte de cartera: la regla de «vencido» es la misma que ve el administrador en Reportes.
 */
export const listDueItems = async (role: Role): Promise<DueNoticesResponse> => {
  const [batches, receivables] = await Promise.all([
    seesBatches(role) ? listExpiringBatches(WINDOW, DUE_BATCH_DAYS) : Promise.resolve(null),
    seesReceivables(role) ? receivablesReport(DEFAULT_OVERDUE_DAYS) : Promise.resolve(null),
  ]);
  const items = classifyDue(role, batches?.items ?? [], receivables?.items ?? [], { overdueDays: DEFAULT_OVERDUE_DAYS, today: todayIso() });
  return { count: items.length, summary: summarizeDue(items), items };
};
