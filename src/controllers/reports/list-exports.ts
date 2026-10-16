import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { Roles, requireAuth } from "../../security/index";
import { listExports } from "../../business-logic/reports/index";

/** GET /api/v1/reports/exports — ADMIN ve el historial de todo el equipo; SALES, solo el suyo. */
export const listExportsController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.json(await listExports(parsePageRequest(req.query), { userId: auth.role === Roles.ADMIN ? undefined : auth.userId }));
};
