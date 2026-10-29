import { todayIso } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import type { ScheduledCount } from "../../models/index";

/**
 * Conteos pendientes para el calendario y los avisos: estado PLANNED o IN_PROGRESS con `scheduled_date <= untilDate`
 * (incluye los atrasados, de cualquier fecha anterior, salvo que se pase `fromDate`). Ordenados por fecha y id.
 *
 * Forma de cada elemento (`ScheduledCount`, en models/stock-counts.ts):
 *   { id: number, title: string, scheduledDate: "YYYY-MM-DD", status: "PLANNED" | "IN_PROGRESS",
 *     scope: "ALL" | "CATEGORY", categoryId: number | null, categoryName: string | null,
 *     overdue: boolean  // scheduledDate < hoy en BUSINESS_TZ }
 * Solo deben verlos ADMIN y WAREHOUSE (quien lo use filtra por rol); el enlace de la app es `/conteos?c=<id>`.
 */
export const listScheduledCounts = async (
  untilDate: string,
  options: { fromDate?: string | undefined; q?: Queryable } = {},
): Promise<ScheduledCount[]> => {
  const q = options.q ?? db;
  const { rows } = await q.query<Omit<ScheduledCount, "overdue">>(
    `SELECT sc.id, sc.title, sc.scheduled_date AS "scheduledDate", sc.status, sc.scope,
            sc.category_id AS "categoryId", c.name AS "categoryName"
     FROM stock_counts sc
     LEFT JOIN categories c ON c.id = sc.category_id
     WHERE sc.status IN ('PLANNED', 'IN_PROGRESS')
       AND sc.scheduled_date <= $1::date
       AND ($2::date IS NULL OR sc.scheduled_date >= $2::date)
     ORDER BY sc.scheduled_date, sc.id`,
    [untilDate, options.fromDate ?? null],
  );
  const today = todayIso();
  return rows.map((r) => ({ ...r, overdue: r.scheduledDate < today }));
};
