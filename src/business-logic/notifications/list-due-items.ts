import { addDaysIso, todayIso } from "../../common/index";
import type { DueNoticesResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { listExpiringBatches } from "../batches/list-expiring-batches";
import { DEFAULT_OVERDUE_DAYS } from "../customers/get-customer-balance";
import { receivablesReport } from "../reports/receivables-report";
import { listDueOrders } from "../orders/list-due-orders";
import { listUpcomingPayroll } from "../payroll/list-upcoming-payroll";
import { listScheduledCounts } from "../stock-counts/list-scheduled-counts";
import { COUNT_SOON_DAYS, DUE_BATCH_DAYS, ORDER_SOON_DAYS, PAYROLL_SOON_DAYS, classifyDue, seesBatches, seesCounts, seesPayroll, seesReceivables, summarizeDue } from "./due-items";

const WINDOW = { page: 1, limit: 100, offset: 0 };

/**
 * Avisos de vencimiento de una persona según su rol (brief 2026, punto 13). Reutiliza las consultas de lotes por
 * vencer y del reporte de cartera (la regla de «vencido» es la misma que ve el administrador en Reportes) y las de
 * pedidos abiertos, nómina sin pagar y conteos pendientes.
 */
export const listDueItems = async (role: Role): Promise<DueNoticesResponse> => {
  const today = todayIso();
  const [batches, receivables, orders, payroll, counts] = await Promise.all([
    seesBatches(role) ? listExpiringBatches(WINDOW, DUE_BATCH_DAYS) : Promise.resolve(null),
    seesReceivables(role) ? receivablesReport(DEFAULT_OVERDUE_DAYS) : Promise.resolve(null),
    listDueOrders(role, addDaysIso(today, ORDER_SOON_DAYS)),
    seesPayroll(role) ? listUpcomingPayroll(addDaysIso(today, PAYROLL_SOON_DAYS)) : Promise.resolve([]),
    seesCounts(role) ? listScheduledCounts(addDaysIso(today, COUNT_SOON_DAYS)) : Promise.resolve([]),
  ]);
  const items = classifyDue(role, batches?.items ?? [], receivables?.items ?? [], { overdueDays: DEFAULT_OVERDUE_DAYS, today }, { orders, payroll, counts });
  return { count: items.length, summary: summarizeDue(items), items };
};
