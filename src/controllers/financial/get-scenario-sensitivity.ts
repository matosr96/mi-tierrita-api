import type { RequestHandler } from "express";
import { ErrorCodes, domainError, parseId } from "../../common/index";
import { isSensitivityVariable, parseRangeQuery } from "../../models/index";
import { getScenarioSensitivity, SENSITIVITY_VARIABLES } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/:id/sensitivity?variable=salesIncrease&from=&to=&step= — ADMIN (CU-17). */
export const getScenarioSensitivityController: RequestHandler = async (req, res) => {
  const variable = req.query["variable"];
  if (!isSensitivityVariable(variable)) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "variable", message: `Debe ser una de: ${SENSITIVITY_VARIABLES.join(", ")}` }]);
  }
  const range = parseRangeQuery(req.query);
  if (range === null) throw domainError(ErrorCodes.VALIDATION, [{ path: "range", message: "from, to y step deben venir juntos" }]);
  res.json(await getScenarioSensitivity(parseId(req.params["id"]), variable, range));
};
