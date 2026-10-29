import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdatePayrollEmployee } from "../../models/index";
import { updatePayrollEmployee } from "../../business-logic/payroll/index";

/** PUT /api/v1/payroll/employees/:id — ADMIN (también activa o desactiva con `active`). */
export const updatePayrollEmployeeController: RequestHandler = async (req, res) => {
  res.json(await updatePayrollEmployee(parseId(req.params["id"]), parseUpdatePayrollEmployee(req.body)));
};
