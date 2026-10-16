import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateReportExport } from "../../models/index";
import { recordExport } from "../../business-logic/reports/index";

/** POST /api/v1/reports/exports — ADMIN, SALES. Registra una descarga en PDF o Excel. */
export const recordExportController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.status(201).json(await recordExport(auth.userId, auth.role, parseCreateReportExport(req.body)));
};
