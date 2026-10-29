import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { deletePayrollPeriod } from "../../business-logic/payroll/index";

/** DELETE /api/v1/payroll/periods/:id — ADMIN. Solo borradores. */
export const deletePayrollPeriodController: RequestHandler = async (req, res) => {
  await deletePayrollPeriod(parseId(req.params["id"]));
  res.status(204).send();
};
