import type { RequestHandler } from "express";
import { ErrorCodes, domainError, parseId, type ValidationIssue } from "../../common/index";
import { isSensitivityVariable, parseRangeQuery } from "../../models/index";
import { getScenarioBivariate, SENSITIVITY_VARIABLES } from "../../business-logic/financial/index";

/** GET /api/v1/financial/scenarios/:id/sensitivity/bivariate?varX=&varY=[&fromX=&toX=&stepX=&fromY=&toY=&stepY=] — ADMIN (CU-17). */
export const getScenarioBivariateController: RequestHandler = async (req, res) => {
  const issues: ValidationIssue[] = [];
  const varX = req.query["varX"];
  const varY = req.query["varY"];
  const allowed = `Debe ser una de: ${SENSITIVITY_VARIABLES.join(", ")}`;
  if (!isSensitivityVariable(varX)) issues.push({ path: "varX", message: allowed });
  if (!isSensitivityVariable(varY)) issues.push({ path: "varY", message: allowed });
  const rangeX = parseRangeQuery(req.query, "X");
  const rangeY = parseRangeQuery(req.query, "Y");
  if (rangeX === null) issues.push({ path: "rangeX", message: "fromX, toX y stepX deben venir juntos" });
  if (rangeY === null) issues.push({ path: "rangeY", message: "fromY, toY y stepY deben venir juntos" });
  if (issues.length > 0 || !isSensitivityVariable(varX) || !isSensitivityVariable(varY) || rangeX === null || rangeY === null) {
    throw domainError(ErrorCodes.VALIDATION, issues);
  }
  res.json(await getScenarioBivariate(parseId(req.params["id"]), varX, varY, rangeX, rangeY));
};
