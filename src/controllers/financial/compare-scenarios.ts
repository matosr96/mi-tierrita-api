import type { RequestHandler } from "express";
import { ErrorCodes, domainError } from "../../common/index";
import { parseIdsQuery } from "../../models/index";
import { compareScenarios } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/compare?ids=1,2,3 — ADMIN (CU-15). */
export const compareScenariosController: RequestHandler = async (req, res) => {
  const ids = parseIdsQuery(req.query["ids"]);
  if (ids === undefined || ids.length < 2) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "ids", message: "Indique al menos dos ids separados por coma" }]);
  }
  res.json(await compareScenarios(ids));
};
