import { todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import type { CalendarResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { ALARM_COLUMNS } from "../alarms/find-alarm";
import { DEFAULT_OVERDUE_DAYS } from "../customers/get-customer-balance";
import { seesBatches, seesCounts, seesPayroll, seesReceivables } from "../notifications/due-items";
import { listDueOrders } from "../orders/list-due-orders";
import { listUpcomingPayroll } from "../payroll/list-upcoming-payroll";
import { listScheduledCounts } from "../stock-counts/list-scheduled-counts";
import { receivablesReport } from "../reports/receivables-report";
import { buildCalendar, type CalendarAlarm, type CalendarAlarmFire, type CalendarBatch } from "./build-calendar";

/**
 * Calendario de una persona para un rango: consulta lo que su rol puede ver (lotes, cartera, pedidos, nómina,
 * conteos), sus alarmas y sus disparos, y delega el armado a `buildCalendar`. La regla de «vencido» de la cartera es la del reporte.
 */
export const getCalendar = async (userId: number, role: Role, from: string, to: string, now: Date = new Date()): Promise<CalendarResponse> => {
  const [batches, receivables, { rows: alarms }, { rows: alarmFires }, orders, payroll, counts] = await Promise.all([
    seesBatches(role)
      ? db
          .query<CalendarBatch>(
            `SELECT b.id, p.name AS "productName", b.quantity_remaining AS "quantityRemaining", b.expires_at::text AS "expiresAt"
             FROM product_batches b JOIN products p ON p.id = b.product_id
             WHERE b.quantity_remaining > 0 AND b.expires_at BETWEEN $1 AND $2
             ORDER BY b.expires_at, b.id`,
            [from, to],
          )
          .then((r) => r.rows)
      : Promise.resolve([] as CalendarBatch[]),
    seesReceivables(role) ? receivablesReport(DEFAULT_OVERDUE_DAYS).then((r) => r.items) : Promise.resolve([]),
    db.query<CalendarAlarm>(`SELECT ${ALARM_COLUMNS} FROM alarms a WHERE a.user_id = $1 AND a.active ORDER BY a.id`, [userId]),
    db.query<CalendarAlarmFire>(
      `SELECT f.id, f.alarm_id AS "alarmId", a.title, f.fired_at AS "firedAt"
       FROM alarm_fires f JOIN alarms a ON a.id = f.alarm_id
       WHERE a.user_id = $1 AND f.fired_at >= ($2::date)::timestamptz AND f.fired_at < ($3::date + 1)::timestamptz
       ORDER BY f.fired_at`,
      [userId, from, to],
    ),
    listDueOrders(role, to, from),
    seesPayroll(role) ? listUpcomingPayroll(to) : Promise.resolve([]),
    seesCounts(role) ? listScheduledCounts(to, { fromDate: from }) : Promise.resolve([]),
  ]);
  return buildCalendar(role, from, to, { today: todayIso(now), now, batches, receivables, overdueDays: DEFAULT_OVERDUE_DAYS, alarms, alarmFires, orders, payroll, counts });
};
