import type { RequestHandler } from "express";
import { describeAudit, recordAudit } from "../business-logic/audits/index";
import { getAuth } from "../security/index";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Rutas POST que no cambian datos de negocio y no se auditan: consultas al asistente y el acuse de lectura del chat
 * (se envía cada vez que alguien ve un mensaje; auditarlo llenaría la bitácora sin aportar nada).
 */
const READ_ONLY_POSTS = /\/ai\/|\/chat\/read$/;

/**
 * Middleware de auditoría (RF-07.1): registra automáticamente cada escritura exitosa
 * (usuario, método, recurso, fecha) sin que cada ruta tenga que hacerlo, y desde el brief de octubre de 2026
 * (punto 33) también el registro tocado (`entity`, `entityId`) y qué cambió (`changes`), que `describeAudit`
 * deduce de la ruta, del cuerpo de la petición y del cuerpo JSON de la respuesta (se intercepta `res.json`
 * solo en escrituras; nunca se guarda la respuesta completa ni campos sensibles).
 * Se ejecuta al terminar la respuesta; una falla al auditar se registra en el log
 * y no afecta la respuesta ya enviada.
 */
export const auditMiddleware: RequestHandler = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }
  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as typeof res.json;

  res.on("finish", () => {
    if (res.statusCode >= 400 || READ_ONLY_POSTS.test(req.originalUrl)) return;
    const auth = getAuth(req);
    if (auth === undefined) return;
    const resource = req.originalUrl.split("?")[0] ?? req.originalUrl;
    // La app envía X-AI-Suggested: 1 cuando la persona confirma una operación que preparó el asistente.
    const aiSuggested = req.get("x-ai-suggested") === "1";
    const { entity, entityId, changes } = describeAudit(req.method, resource, req.body, responseBody);
    void recordAudit({ userId: auth.userId, method: req.method, resource, aiSuggested, entity, entityId, changes }).catch((err: unknown) =>
      console.error("No se pudo registrar la auditoría:", err),
    );
  });
  next();
};
