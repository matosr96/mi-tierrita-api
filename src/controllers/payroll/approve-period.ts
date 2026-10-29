import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { approvePayrollPeriod } from "../../business-logic/payroll/index";

/** POST /api/v1/payroll/periods/:id/approve — ADMIN. */
export const approvePayrollPeriodController: RequestHandler = async (req, res) => {
  res.json(await approvePayrollPeriod(parseId(req.params["id"]), requireAuth(req).userId));
};
