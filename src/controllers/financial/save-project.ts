import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseSaveProject } from "../../models/index";
import { saveProject } from "../../business-logic/financial/index";

/** POST /api/v1/financial/projects — ADMIN («Guardar como»). */
export const saveProjectController: RequestHandler = async (req, res) => {
  res.status(201).json(await saveProject(requireAuth(req).userId, parseSaveProject(req.body)));
};
