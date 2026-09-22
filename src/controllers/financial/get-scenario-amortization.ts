import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getScenarioAmortization } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/:id/amortization — ADMIN (CU-16). */
export const getScenarioAmortizationController: RequestHandler = async (req, res) => {
  res.json(await getScenarioAmortization(parseId(req.params["id"])));
};
