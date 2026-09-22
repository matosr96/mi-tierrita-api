import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateScenario } from "../../models/index";
import { createScenario } from "../../business-logic/financial/index";

/** POST /api/v1/financial/scenarios — ADMIN (CU-14). */
export const createScenarioController: RequestHandler = async (req, res) => {
  res.status(201).json(await createScenario(requireAuth(req).userId, parseCreateScenario(req.body)));
};
