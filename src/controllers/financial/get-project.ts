import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getProject } from "../../business-logic/financial/index";

/** GET /api/v1/financial/projects/:id — ADMIN. */
export const getProjectController: RequestHandler = async (req, res) => {
  res.json(await getProject(parseId(req.params["id"])));
};
