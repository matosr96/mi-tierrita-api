import type { RequestHandler } from "express";
import { queryInt } from "../../common/index";
import { inventoryReport } from "../../business-logic/reports/index";

/** GET /api/v1/reports/inventory?days=30 — ADMIN (CU-20). */
export const inventoryReportController: RequestHandler = async (req, res) => {
  res.json(await inventoryReport(queryInt(req.query["days"], 30)));
};
