import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseProjectScope } from "../../models/index";
import { listProjects } from "../../business-logic/financial/index";

/** GET /api/v1/financial/projects?alcance=todos — ADMIN. Por omisión, solo los proyectos propios. */
export const listProjectsController: RequestHandler = async (req, res) => {
  res.json(await listProjects(requireAuth(req).userId, parseProjectScope(req.query["alcance"]), parsePageRequest(req.query)));
};
