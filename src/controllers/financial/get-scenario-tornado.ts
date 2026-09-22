import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getScenarioTornado } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/:id/tornado — ADMIN (CU-17). */
export const getScenarioTornadoController: RequestHandler = async (req, res) => {
  res.json(await getScenarioTornado(parseId(req.params["id"])));
};
