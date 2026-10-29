import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { listAuditsController, listEntityAuditsController } from "../controllers/audits/index";

export const auditsRouter = Router();
auditsRouter.get("/", authorize(Roles.ADMIN), listAuditsController);
auditsRouter.get("/entity/:entity/:id", authorize(Roles.ADMIN), listEntityAuditsController);
