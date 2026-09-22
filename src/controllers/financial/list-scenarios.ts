import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { listScenarios } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios — ADMIN. */
export const listScenariosController: RequestHandler = async (req, res) => {
  res.json(await listScenarios(parsePageRequest(req.query)));
};
