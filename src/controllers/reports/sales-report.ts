import type { RequestHandler } from "express";
import { addDaysIso, queryDate, todayIso } from "../../common/index";
import { SALES_GROUP_BY, salesReport, type SalesGroupBy } from "../../business-logic/reports/index";

/** GET /api/v1/reports/sales?from=&to=&groupBy=day|product — ADMIN, SALES (CU-19). Por defecto últimos 30 días por día. */
export const salesReportController: RequestHandler = async (req, res) => {
  const today = todayIso();
  const to = queryDate(req.query["to"], today);
  const from = queryDate(req.query["from"], addDaysIso(to, -29));
  const raw = req.query["groupBy"];
  const groupBy: SalesGroupBy = typeof raw === "string" && (SALES_GROUP_BY as readonly string[]).includes(raw) ? (raw as SalesGroupBy) : "day";
  res.json(await salesReport(from, to, groupBy));
};
