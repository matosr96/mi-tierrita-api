import { db } from "../../data-sources/index";

export const SALES_GROUP_BY = ["day", "product"] as const;
export type SalesGroupBy = (typeof SALES_GROUP_BY)[number];

export type SalesReportByDayRow = { date: string; salesCount: number; units: number; total: number };
export type SalesReportByProductRow = { productId: number; productName: string; sku: string; salesCount: number; units: number; total: number };

export type SalesReport = {
  from: string;
  to: string;
  groupBy: SalesGroupBy;
  salesCount: number;
  units: number;
  total: number;
  cashTotal: number;
  creditTotal: number;
  rows: SalesReportByDayRow[] | SalesReportByProductRow[];
};

/** CU-19 Reporte de ventas por día o por producto, solo ventas no anuladas, fechas inclusive. */
export const salesReport = async (from: string, to: string, groupBy: SalesGroupBy): Promise<SalesReport> => {
  const params = [from, to];
  const period = `s.status = 'COMPLETED' AND s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')`;

  const { rows: totals } = await db.query<{ salesCount: number; units: number; total: number; cashTotal: number; creditTotal: number }>(
    `SELECT count(DISTINCT s.id)::int AS "salesCount",
            COALESCE(sum(l.quantity), 0)::int AS units,
            COALESCE(sum(l.line_total), 0) AS total,
            COALESCE(sum(l.line_total) FILTER (WHERE s.payment_type = 'CASH'), 0) AS "cashTotal",
            COALESCE(sum(l.line_total) FILTER (WHERE s.payment_type = 'CREDIT'), 0) AS "creditTotal"
     FROM sales s JOIN sale_lines l ON l.sale_id = s.id
     WHERE ${period}`,
    params,
  );
  const summary = totals[0] ?? { salesCount: 0, units: 0, total: 0, cashTotal: 0, creditTotal: 0 };

  const rows =
    groupBy === "day"
      ? (
          await db.query<SalesReportByDayRow>(
            `SELECT to_char(s.created_at::date, 'YYYY-MM-DD') AS date,
                    count(DISTINCT s.id)::int AS "salesCount",
                    sum(l.quantity)::int AS units,
                    sum(l.line_total) AS total
             FROM sales s JOIN sale_lines l ON l.sale_id = s.id
             WHERE ${period}
             GROUP BY s.created_at::date ORDER BY s.created_at::date`,
            params,
          )
        ).rows
      : (
          await db.query<SalesReportByProductRow>(
            `SELECT p.id AS "productId", p.name AS "productName", p.sku,
                    count(DISTINCT s.id)::int AS "salesCount",
                    sum(l.quantity)::int AS units,
                    sum(l.line_total) AS total
             FROM sales s JOIN sale_lines l ON l.sale_id = s.id JOIN products p ON p.id = l.product_id
             WHERE ${period}
             GROUP BY p.id, p.name, p.sku ORDER BY total DESC, p.name`,
            params,
          )
        ).rows;

  return { from, to, groupBy, ...summary, rows };
};
