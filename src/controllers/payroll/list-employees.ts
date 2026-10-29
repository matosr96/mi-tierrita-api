import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { parsePayrollEmployeeQuery } from "../../models/index";
import { listPayrollEmployees } from "../../business-logic/payroll/index";

/** GET /api/v1/payroll/employees?active=&frequency= — ADMIN. */
export const listPayrollEmployeesController: RequestHandler = async (req, res) => {
  res.json(await listPayrollEmployees(parsePageRequest(req.query), parsePayrollEmployeeQuery(req.query)));
};
