import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/index";
import { authorize, Roles } from "../security/index";
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  listPublicCategoriesController,
  updateCategoryController,
} from "../controllers/categories/index";

/** La página pública pide las líneas una vez por visita: más de 60 por minuto desde la misma IP responde 429 (640). */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

/** Ruta pública de las líneas de la página pública (migración 0018): se monta ANTES del middleware authenticate. */
export const categoriesPublicRouter = Router();
categoriesPublicRouter.get("/public", publicLimiter, listPublicCategoriesController);

export const categoriesRouter = Router();
categoriesRouter.post("/", authorize(Roles.ADMIN, Roles.WAREHOUSE), createCategoryController);
categoriesRouter.get("/", listCategoriesController);
categoriesRouter.put("/:id", authorize(Roles.ADMIN, Roles.WAREHOUSE), updateCategoryController);
categoriesRouter.delete("/:id", authorize(Roles.ADMIN), deleteCategoryController);
