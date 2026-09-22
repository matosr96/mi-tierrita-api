import { Router } from "express";
import { authorize, Roles } from "../security/index";
import {
  compareScenariosController,
  createScenarioController,
  getScenarioAmortizationController,
  getScenarioBivariateController,
  getScenarioController,
  getScenarioSensitivityController,
  getScenarioTornadoController,
  listScenariosController,
} from "../controllers/financial/index";

export const financialRouter = Router();
financialRouter.use(authorize(Roles.ADMIN));
financialRouter.post("/scenarios", createScenarioController);
financialRouter.get("/scenarios", listScenariosController);
financialRouter.get("/scenarios/compare", compareScenariosController); // antes de /:id
financialRouter.get("/scenarios/:id", getScenarioController);
financialRouter.get("/scenarios/:id/amortization", getScenarioAmortizationController);
financialRouter.get("/scenarios/:id/sensitivity", getScenarioSensitivityController);
financialRouter.get("/scenarios/:id/sensitivity/bivariate", getScenarioBivariateController);
financialRouter.get("/scenarios/:id/tornado", getScenarioTornadoController);
