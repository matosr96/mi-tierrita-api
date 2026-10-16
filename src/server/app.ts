import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./error-handler";
import { auditMiddleware } from "./audit";
import { apiRouter, docsRouter, healthRouter } from "../routes/index";

/** Arma la aplicación Express con los componentes transversales y las rutas. */
export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // la API corre detrás de un balanceador / proxy HTTPS
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  // La foto de una factura para el asistente pesa más que cualquier otro cuerpo; el resto conserva el límite de 1 MB.
  const jsonSmall = express.json({ limit: "1mb" });
  const jsonInvoice = express.json({ limit: "8mb" });
  // Las fotos de facturas y los documentos que se le adjuntan a Tita pesan más que cualquier otro cuerpo.
  const jsonChat = express.json({ limit: "24mb" });
  app.use((req, res, next) => (req.path.endsWith("/ai/invoice") ? jsonInvoice : req.path.endsWith("/ai/chat") ? jsonChat : jsonSmall)(req, res, next));

  // Públicas sin prefijo (documento 06, "Salud y documentación")
  app.use("/health", healthRouter);
  app.use("/docs", docsRouter);

  // Toda la API versionada; la auditoría envuelve todas las rutas
  app.use(config.apiPrefix, auditMiddleware, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
