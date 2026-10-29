import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getPayrollPeriod } from "../../business-logic/payroll/index";

/** GET /api/v1/payroll/periods/:id — ADMIN. Periodo con líneas y totales. */
export const getPayrollPeriodController: RequestHandler = async (req, res) => {
  res.json(await getPayrollPeriod(parseId(req.params["id"])));
};
