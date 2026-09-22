import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { auditMiddleware } from "./audit.js";
import { apiRouter, docsRouter, healthRouter } from "../routes/index.js";

/** Arma la aplicación Express con los componentes transversales y las rutas. */
export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // la API corre detrás de un balanceador / proxy HTTPS
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json({ limit: "1mb" }));

  // Públicas sin prefijo (documento 06, "Salud y documentación")
  app.use("/health", healthRouter);
  app.use("/docs", docsRouter);

  // Toda la API versionada; la auditoría envuelve todas las rutas
  app.use(config.apiPrefix, auditMiddleware, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
