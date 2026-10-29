import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseUpdateProject } from "../../models/index";
import { updateProject } from "../../business-logic/financial/index";

/** PUT /api/v1/financial/projects/:id — ADMIN dueño del proyecto («Guardar proyecto»). */
export const updateProjectController: RequestHandler = async (req, res) => {
  res.json(await updateProject(parseId(req.params["id"]), requireAuth(req).userId, parseUpdateProject(req.body)));
};
