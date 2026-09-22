import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { listExpiringBatchesController } from "../controllers/batches/index";

export const batchesRouter = Router();
batchesRouter.get("/expiring", authorize(Roles.ADMIN, Roles.WAREHOUSE), listExpiringBatchesController);
