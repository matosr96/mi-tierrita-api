import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import { globalSearchController } from "../controllers/search/index";

export const searchRouter = Router();
searchRouter.get("/", authorize(...ALL_ROLES), globalSearchController);
