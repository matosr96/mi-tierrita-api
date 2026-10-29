import type { RequestHandler } from "express";
import { parseCreatePayrollEmployee } from "../../models/index";
import { createPayrollEmployee } from "../../business-logic/payroll/index";

/** POST /api/v1/payroll/employees — ADMIN. */
export const createPayrollEmployeeController: RequestHandler = async (req, res) => {
  res.status(201).json(await createPayrollEmployee(parseCreatePayrollEmployee(req.body)));
};
