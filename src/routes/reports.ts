import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { inventoryReportController, listExportsController, receivablesReportController, recordExportController, salesReportController } from "../controllers/reports/index";

export const reportsRouter = Router();
reportsRouter.get("/sales", authorize(Roles.ADMIN, Roles.SALES), salesReportController);
reportsRouter.get("/inventory", authorize(Roles.ADMIN), inventoryReportController);
reportsRouter.get("/receivables", authorize(Roles.ADMIN), receivablesReportController);
reportsRouter.get("/exports", authorize(Roles.ADMIN, Roles.SALES), listExportsController);
reportsRouter.post("/exports", authorize(Roles.ADMIN, Roles.SALES), recordExportController);
