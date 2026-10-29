import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdatePayrollLine } from "../../models/index";
import { updatePayrollLine } from "../../business-logic/payroll/index";

/** PUT /api/v1/payroll/periods/:id/lines/:lineId — ADMIN. Solo en borrador; recalcula en el servidor. */
export const updatePayrollLineController: RequestHandler = async (req, res) => {
  const periodId = parseId(req.params["id"]);
  const lineId = parseId(req.params["lineId"], "lineId");
  res.json(await updatePayrollLine(periodId, lineId, parseUpdatePayrollLine(req.body)));
};
