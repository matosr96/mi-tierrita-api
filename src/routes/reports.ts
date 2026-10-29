import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/index";
import { authorize, Roles } from "../security/index";
import { inventoryReportController, listExportsController, receivablesReportController, recordExportController, salesReportController, verifyExportController } from "../controllers/reports/index";

/** Quien escanea un QR consulta pocas veces: más de 30 por minuto desde la misma IP responde 429 (640). */
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

/** Ruta pública de verificación de documentos (brief 2.4, punto 25): se monta ANTES del middleware authenticate. */
export const reportsPublicRouter = Router();
reportsPublicRouter.get("/verify/:folio", verifyLimiter, verifyExportController);

export const reportsRouter = Router();
reportsRouter.get("/sales", authorize(Roles.ADMIN, Roles.SALES), salesReportController);
reportsRouter.get("/inventory", authorize(Roles.ADMIN), inventoryReportController);
reportsRouter.get("/receivables", authorize(Roles.ADMIN), receivablesReportController);
reportsRouter.get("/exports", authorize(Roles.ADMIN, Roles.SALES), listExportsController);
reportsRouter.post("/exports", authorize(Roles.ADMIN, Roles.SALES), recordExportController);
