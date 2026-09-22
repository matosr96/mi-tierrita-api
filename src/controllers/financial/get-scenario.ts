import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getScenario } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/:id — ADMIN. */
export const getScenarioController: RequestHandler = async (req, res) => {
  res.json(await getScenario(parseId(req.params["id"])));
};
