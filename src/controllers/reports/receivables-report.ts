import type { RequestHandler } from "express";
import { queryInt } from "../../common/index";
import { DEFAULT_OVERDUE_DAYS } from "../../business-logic/customers/index";
import { receivablesReport } from "../../business-logic/reports/index";

/** GET /api/v1/reports/receivables?overdueDays=30 — ADMIN (CU-20). */
export const receivablesReportController: RequestHandler = async (req, res) => {
  res.json(await receivablesReport(queryInt(req.query["overdueDays"], DEFAULT_OVERDUE_DAYS)));
};
