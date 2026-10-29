import type { RequestHandler } from "express";
import { parseCreatePayrollPeriod } from "../../models/index";
import { requireAuth } from "../../security/index";
import { createPayrollPeriod } from "../../business-logic/payroll/index";

/** POST /api/v1/payroll/periods — ADMIN. Crea el borrador con las líneas de los empleados activos de la frecuencia. */
export const createPayrollPeriodController: RequestHandler = async (req, res) => {
  const input = parseCreatePayrollPeriod(req.body);
  res.status(201).json(await createPayrollPeriod(input, requireAuth(req).userId));
};
