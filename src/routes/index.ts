import { Router } from "express";
import { authenticate } from "../security/index.js";
import { signinRoute, signoutRoute, meRoute } from "./auth/index.js";
import { createUserRoute, listUsersRoute, getUserRoute, changeOwnPasswordRoute } from "./users/index.js";
import {
  createCategoryRoute,
  listCategoriesRoute,
  updateCategoryRoute,
  deleteCategoryRoute,
} from "./categories/index.js";

export { healthRouter } from "./health.js";
export { docsRouter } from "./docs.js";

/**
 * Router de /api/v1. Toda ruta nace protegida (RNF-01): las únicas rutas públicas
 * se montan ANTES del middleware de autenticación; todo lo que se monte después
 * exige token válido, y cada ruta restringe además por rol con authorize(...).
 */
export const apiRouter = Router();

// --- públicas ---
apiRouter.use("/auth", signinRoute);

// --- a partir de aquí, autenticación obligatoria ---
apiRouter.use(authenticate);

apiRouter.use("/auth", signoutRoute, meRoute);
apiRouter.use("/users", changeOwnPasswordRoute, createUserRoute, listUsersRoute, getUserRoute);
apiRouter.use("/categories", createCategoryRoute, listCategoriesRoute, updateCategoryRoute, deleteCategoryRoute);
