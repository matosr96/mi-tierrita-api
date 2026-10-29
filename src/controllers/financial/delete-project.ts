import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { deleteProject } from "../../business-logic/financial/index";

/** DELETE /api/v1/financial/projects/:id — ADMIN dueño del proyecto. */
export const deleteProjectController: RequestHandler = async (req, res) => {
  await deleteProject(parseId(req.params["id"]), requireAuth(req).userId);
  res.status(204).end();
};
