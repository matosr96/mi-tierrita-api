import type { RequestHandler } from "express";
import { db } from "../../data-sources/index";

/** GET /health (público): estado del proceso y de la conexión a la base. */
export const healthController: RequestHandler = async (_req, res) => {
  let database: "up" | "down" = "up";
  try {
    await db.ping();
  } catch {
    database = "down";
  }
  res.status(database === "up" ? 200 : 503).json({ status: database === "up" ? "ok" : "degraded", database });
};
