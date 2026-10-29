import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { parsePayrollPeriodQuery } from "../../models/index";
import { listPayrollPeriods } from "../../business-logic/payroll/index";

/** GET /api/v1/payroll/periods?status=&year= — ADMIN. */
export const listPayrollPeriodsController: RequestHandler = async (req, res) => {
  res.json(await listPayrollPeriods(parsePageRequest(req.query), parsePayrollPeriodQuery(req.query)));
};
