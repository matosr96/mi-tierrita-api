import { Router } from "express";
import { healthController } from "../controllers/system/index";

export const healthRouter = Router();
healthRouter.get("/", healthController);
