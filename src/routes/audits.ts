import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { listAuditsController } from "../controllers/audits/index";

export const auditsRouter = Router();
auditsRouter.get("/", authorize(Roles.ADMIN), listAuditsController);
