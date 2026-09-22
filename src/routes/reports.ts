import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { inventoryReportController, receivablesReportController, salesReportController } from "../controllers/reports/index";

export const reportsRouter = Router();
reportsRouter.get("/sales", authorize(Roles.ADMIN, Roles.SALES), salesReportController);
reportsRouter.get("/inventory", authorize(Roles.ADMIN), inventoryReportController);
reportsRouter.get("/receivables", authorize(Roles.ADMIN), receivablesReportController);
