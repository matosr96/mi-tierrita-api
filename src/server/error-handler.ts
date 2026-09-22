import type { ErrorRequestHandler, RequestHandler } from "express";
import { ErrorCodes, isDomainError } from "../common/index.js";

/** Ruta inexistente: se responde con el mismo contrato de error que el resto. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: ErrorCodes.ROUTE_NOT_FOUND });
};

/**
 * Manejador de errores único (documento 01, sección 5): traduce cualquier error de
 * negocio a { message: "<código>" } con su estado HTTP. Un error inesperado responde
 * 500 con el código genérico y se registra en el log del servidor, nunca al cliente.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isDomainError(err)) {
    const body: { message: string; details?: unknown } = { message: err.code };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  // JSON mal formado en el body lo detecta el parser de Express antes de llegar a la ruta
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ message: ErrorCodes.VALIDATION, details: [{ path: "body", message: "JSON inválido" }] });
    return;
  }

  console.error("Error no controlado:", err);
  res.status(500).json({ message: ErrorCodes.INTERNAL });
};
