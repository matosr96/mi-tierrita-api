import { Router } from "express";
import { authorize, Roles } from "../security/index";
import {
  approvePayrollPeriodController,
  createPayrollEmployeeController,
  createPayrollPeriodController,
  deletePayrollPeriodController,
  getPayrollPeriodController,
  listPayrollEmployeesController,
  listPayrollPeriodsController,
  payPayrollPeriodController,
  updatePayrollEmployeeController,
  updatePayrollLineController,
} from "../controllers/payroll/index";

/** Nómina simplificada (0015): solo el Administrador; Secretaria y Bodega reciben 613. */
export const payrollRouter = Router();
const adminOnly = authorize(Roles.ADMIN);
payrollRouter.get("/employees", adminOnly, listPayrollEmployeesController);
payrollRouter.post("/employees", adminOnly, createPayrollEmployeeController);
payrollRouter.put("/employees/:id", adminOnly, updatePayrollEmployeeController);
payrollRouter.get("/periods", adminOnly, listPayrollPeriodsController);
payrollRouter.post("/periods", adminOnly, createPayrollPeriodController);
payrollRouter.get("/periods/:id", adminOnly, getPayrollPeriodController);
payrollRouter.put("/periods/:id/lines/:lineId", adminOnly, updatePayrollLineController);
payrollRouter.post("/periods/:id/approve", adminOnly, approvePayrollPeriodController);
payrollRouter.post("/periods/:id/pay", adminOnly, payPayrollPeriodController);
payrollRouter.delete("/periods/:id", adminOnly, deletePayrollPeriodController);
