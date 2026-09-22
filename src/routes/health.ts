import { Router } from "express";
import { db } from "../data-sources/index.js";

/** GET /health (público): estado del proceso y de la conexión a la base. */
export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let database: "up" | "down" = "up";
  try {
    await db.ping();
  } catch {
    database = "down";
  }
  res.status(database === "up" ? 200 : 503).json({ status: database === "up" ? "ok" : "degraded", database });
});
