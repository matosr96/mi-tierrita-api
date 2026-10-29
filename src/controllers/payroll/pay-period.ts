import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { payPayrollPeriod } from "../../business-logic/payroll/index";

/** POST /api/v1/payroll/periods/:id/pay — ADMIN. Marca pagado (quién y cuándo). */
export const payPayrollPeriodController: RequestHandler = async (req, res) => {
  res.json(await payPayrollPeriod(parseId(req.params["id"]), requireAuth(req).userId));
};
