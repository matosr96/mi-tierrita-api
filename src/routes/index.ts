import { Router } from "express";
import { authenticate } from "../security/index";
import { authPublicRouter, authRouter } from "./auth";
import { usersRouter } from "./users";
import { categoriesRouter } from "./categories";
import { productsRouter } from "./products";
import { batchesRouter } from "./batches";
import { suppliersRouter } from "./suppliers";
import { customersRouter } from "./customers";
import { salesRouter } from "./sales";
import { auditsRouter } from "./audits";
import { reportsRouter } from "./reports";
import { financialRouter } from "./financial";

export { healthRouter } from "./health";
export { docsRouter } from "./docs";

/**
 * Router de /api/v1. Toda ruta nace protegida (RNF-01): las únicas rutas públicas
 * se montan ANTES del middleware de autenticación; todo lo que se monte después
 * exige token válido, y cada ruta restringe además por rol con authorize(...).
 * La matriz de roles es la del documento 06 (Diseño de la API).
 */
export const apiRouter = Router();

// --- públicas ---
apiRouter.use("/auth", authPublicRouter);

// --- a partir de aquí, autenticación obligatoria ---
apiRouter.use(authenticate);

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/batches", batchesRouter);
apiRouter.use("/suppliers", suppliersRouter);
apiRouter.use("/customers", customersRouter);
apiRouter.use("/sales", salesRouter);
apiRouter.use("/audits", auditsRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/financial", financialRouter);
