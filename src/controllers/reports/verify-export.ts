import type { RequestHandler } from "express";
import { parseFolio } from "../../models/index";
import { verifyExport } from "../../business-logic/reports/index";

/** GET /api/v1/reports/verify/:folio — público (QR de la portada), con límite por IP. */
export const verifyExportController: RequestHandler = async (req, res) => {
  res.json(await verifyExport(parseFolio(req.params["folio"])));
};
