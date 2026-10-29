import { Router } from "express";
import { authorize, Roles } from "../security/index";
import {
  compareProjectsController,
  deleteProjectController,
  getProjectController,
  listProjectsController,
  saveProjectController,
  simulatorCalculateController,
  simulatorDefaultsController,
  updateProjectController,
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

// Simulador por unidades (Fase B): una sola fuente de las cifras de pantalla, informe y exportación.
financialRouter.get("/simulator/defaults", simulatorDefaultsController);
financialRouter.post("/simulator/calculate", simulatorCalculateController);
financialRouter.get("/projects", listProjectsController);
financialRouter.post("/projects", saveProjectController);
financialRouter.get("/projects/compare", compareProjectsController); // antes de /:id
financialRouter.get("/projects/:id", getProjectController);
financialRouter.put("/projects/:id", updateProjectController);
financialRouter.delete("/projects/:id", deleteProjectController);
