import { Router } from "express";
import { authenticate } from "../security/index";
import { authPublicRouter, authRouter } from "./auth";
import { usersRouter } from "./users";
import { categoriesPublicRouter, categoriesRouter } from "./categories";
import { productsRouter } from "./products";
import { batchesRouter } from "./batches";
import { suppliersRouter } from "./suppliers";
import { customersRouter } from "./customers";
import { salesRouter } from "./sales";
import { auditsRouter } from "./audits";
import { searchRouter } from "./search";
import { commentsRouter } from "./comments";
import { reportsPublicRouter, reportsRouter } from "./reports";
import { financialRouter } from "./financial";
import { chatRouter } from "./chat";
import { contactMessagesRouter, contactPublicRouter } from "./contact";
import { aiRouter } from "./ai";
import { alarmsRouter } from "./alarms";
import { notificationsRouter } from "./notifications";
import { pushRouter } from "./push";
import { libraryRouter } from "./library";
import { calendarRouter } from "./calendar";
import { ordersRouter } from "./orders";
import { payrollRouter } from "./payroll";
import { stockCountsRouter } from "./stock-counts";

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
apiRouter.use("/contact", contactPublicRouter);
apiRouter.use("/reports", reportsPublicRouter);
apiRouter.use("/categories", categoriesPublicRouter);

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
apiRouter.use("/search", searchRouter);
apiRouter.use("/comments", commentsRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/financial", financialRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/contact-messages", contactMessagesRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/alarms", alarmsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/push", pushRouter);
apiRouter.use("/library", libraryRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/payroll", payrollRouter);
apiRouter.use("/stock-counts", stockCountsRouter);
