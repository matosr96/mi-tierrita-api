import { ErrorCodes, domainError } from "../../common/index";
import { toScenarioInput } from "../../models/index";
import { bivariateSensitivity, DEFAULT_SENSITIVITY_RANGES, sensitivity, tornado, type Range, type SensitivityVariable } from "./engine";
import { requireScenario } from "./find-scenario";

const guardRange = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCodes.INVALID_SCENARIO) throw domainError(ErrorCodes.INVALID_SCENARIO);
    throw err;
  }
};

/** CU-17 / RF-06.5 Sensibilidad univariante: VPN/TIR moviendo una variable en un rango. */
export const getScenarioSensitivity = async (id: number, variable: SensitivityVariable, range?: Range) => {
  const scenario = await requireScenario(id);
  const effective = range ?? DEFAULT_SENSITIVITY_RANGES[variable];
  const result = guardRange(() => sensitivity(toScenarioInput(scenario), variable, effective));
  return { scenarioId: id, range: effective, ...result };
};

/** RF-06.6 Sensibilidad bivariante: grilla de VPN sobre dos variables. */
export const getScenarioBivariate = async (id: number, varX: SensitivityVariable, varY: SensitivityVariable, rangeX?: Range, rangeY?: Range) => {
  if (varX === varY) throw domainError(ErrorCodes.VALIDATION, [{ path: "varY", message: "Debe ser distinta de varX" }]);
  const scenario = await requireScenario(id);
  const result = guardRange(() => bivariateSensitivity(toScenarioInput(scenario), varX, varY, rangeX, rangeY));
  return { scenarioId: id, ...result };
};

/** RF-06.7 Tornado: VPN a −20 %/+20 % por variable, ordenado por amplitud. */
export const getScenarioTornado = async (id: number, delta = 0.2) => {
  const scenario = await requireScenario(id);
  return { scenarioId: id, delta, baseNpv: scenario.results.npv, bars: tornado(toScenarioInput(scenario), delta) };
};
