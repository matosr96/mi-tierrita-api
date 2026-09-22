import type { RequestHandler } from "express";
import { auditsDataSource } from "../data-sources/index.js";
import { getAuth } from "../security/index.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Middleware de auditoría (RF-07.1): registra automáticamente cada escritura exitosa
 * (usuario, método, recurso, fecha) sin que cada ruta tenga que hacerlo.
 * Se ejecuta al terminar la respuesta; una falla al auditar se registra en el log
 * y no afecta la respuesta ya enviada.
 */
export const auditMiddleware: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    if (!WRITE_METHODS.has(req.method) || res.statusCode >= 400) return;
    const auth = getAuth(req);
    if (auth === undefined) return;
    const resource = req.originalUrl.split("?")[0] ?? req.originalUrl;
    void auditsDataSource
      .insert({ userId: auth.userId, method: req.method, resource })
      .catch((err: unknown) => console.error("No se pudo registrar la auditoría:", err));
  });
  next();
};
