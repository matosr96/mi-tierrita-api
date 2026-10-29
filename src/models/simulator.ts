import { createValidator, type ValidationIssue, type Validator } from "../common/validate";
import { ErrorCodes, domainError } from "../common/errors";
import {
  SATISFACTION_SCALE,
  SIMULATOR_DEFAULTS,
  simulate,
  type Competitor,
  type FixedCost,
  type SimulatorInput,
  type SimulatorResult,
} from "../business-logic/financial/simulator";

export type FinancialProjectRow = {
  id: number;
  name: string;
  userId: number;
  username: string;
  input: SimulatorInput;
  createdAt: Date;
  updatedAt: Date;
};

/** Lo que se ve de un proyecto en la lista y en la comparación (todo sale de `simulate`). */
export type ProjectSummaryResponse = {
  id: number;
  name: string;
  userId: number;
  username: string;
  highlights: { totalInvestment: number; creditPct: number; termMonths: number; growth: number; annualUnits: number; price: number; marginOnCost: number };
  indicators: { npv: number; irr: number | null; paybackSimple: number | null; benefitCostRatio: number; installment: number; minCoverage: number | null };
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetailResponse = ProjectSummaryResponse & { input: SimulatorInput; result: SimulatorResult };

export const toProjectSummary = (row: FinancialProjectRow, result: SimulatorResult = simulate(row.input)): ProjectSummaryResponse => ({
  id: row.id,
  name: row.name,
  userId: row.userId,
  username: row.username,
  highlights: {
    totalInvestment: result.investment.total,
    creditPct: row.input.financing.creditPct,
    termMonths: row.input.financing.termMonths,
    growth: result.market.growth,
    annualUnits: result.competition.annualUnits,
    price: result.costs.price,
    marginOnCost: result.costs.marginOnCost,
  },
  indicators: {
    npv: result.indicators.npv,
    irr: result.indicators.irr,
    paybackSimple: result.indicators.paybackSimple,
    benefitCostRatio: result.indicators.benefitCostRatio,
    installment: result.financing.installment,
    minCoverage: result.financing.minCoverage,
  },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toProjectDetail = (row: FinancialProjectRow): ProjectDetailResponse => {
  const result = simulate(row.input);
  return { ...toProjectSummary(row, result), input: row.input, result };
};

// ---------------------------------------------------------------------------
// Validación de la entrada del simulador
// ---------------------------------------------------------------------------

type Rule = { min: number; max: number; integer?: boolean };
const MONEY: Rule = { min: 0, max: 1e13 };
const FRACTION: Rule = { min: 0, max: 1 };
const SENSITIVITY: Rule = { min: -10, max: 10 };
const YEARS: Rule = { min: 1, max: 100, integer: true };

const RULES: { [S in keyof SimulatorInput]: Partial<Record<keyof SimulatorInput[S], Rule>> } = {
  market: {
    population: { min: 0, max: 1e9, integer: true },
    purchaseIntent: FRACTION,
    consumptionPerPerson: { min: 0, max: 1e6 },
    gdpGrowth: { min: -1, max: 1 },
    gdpSensitivity: SENSITIVITY,
    unemploymentChange: { min: -1, max: 1 },
    unemploymentSensitivity: SENSITIVITY,
  },
  competition: { conversionFactor: FRACTION },
  costs: { variableUnitCost: { min: 0, max: 1e9 }, inflation: { min: -0.5, max: 1 }, marginOnCost: { min: 0, max: 10 } },
  investment: {
    fixedAssets: MONEY,
    workingCapital: MONEY,
    deferred: MONEY,
    contingencies: MONEY,
    depreciationYears: YEARS,
    deferredAmortizationYears: YEARS,
  },
  financing: { creditPct: FRACTION, creditRateEA: { min: 0, max: 5 }, termMonths: { min: 1, max: 360, integer: true } },
  evaluation: { horizonYears: { min: 1, max: 30, integer: true }, discountRate: { min: 0, max: 5 }, taxRate: { min: 0, max: 0.99 } },
};

const SECTIONS = Object.keys(RULES) as (keyof SimulatorInput)[];

const objectAt = (raw: unknown, key: string): unknown =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>)[key] : undefined;

const parseCompetitor = (item: Validator): Competitor | undefined => {
  const name = item.string("name", { min: 1, max: 80 });
  const share = item.number("share", FRACTION);
  const satisfaction = item.number("satisfaction", { min: 0, max: SATISFACTION_SCALE });
  return name === undefined || share === undefined || satisfaction === undefined ? undefined : { name, share, satisfaction };
};

const parseFixedCost = (item: Validator): FixedCost | undefined => {
  const name = item.string("name", { min: 1, max: 80 });
  const annual = item.number("annual", MONEY);
  return name === undefined || annual === undefined ? undefined : { name, annual };
};

/**
 * Valida la entrada del simulador. Cada sección y cada campo son opcionales: lo que no llegue se toma de
 * `SIMULATOR_DEFAULTS` (el ejemplo del brief); las listas de competidores y costos fijos, si llegan, reemplazan
 * las del ejemplo. Los problemas se acumulan en `issues` con la ruta completa (`input.market.population`).
 */
export const readSimulatorInput = (raw: unknown, path = "input"): { input: SimulatorInput; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const input: SimulatorInput = structuredClone(SIMULATOR_DEFAULTS);
  if (raw === undefined || raw === null) return { input, issues };
  const root = createValidator(raw, path);
  issues.push(...root.issues());
  if (issues.length > 0) return { input, issues };

  for (const section of SECTIONS) {
    const rawSection = objectAt(raw, section);
    if (rawSection === undefined || rawSection === null) continue;
    const v = createValidator(rawSection, `${path}.${section}`);
    const target = input[section] as Record<string, unknown>;
    for (const [field, rule] of Object.entries(RULES[section]) as [string, Rule][]) {
      const value = v.number(field, rule, false);
      if (value !== undefined) target[field] = value;
    }
    if (section === "competition" && v.has("competitors")) {
      const list = v.array("competitors", { max: 20 }, parseCompetitor);
      if (list !== undefined) input.competition.competitors = list;
    }
    if (section === "costs" && v.has("fixedCosts")) {
      const list = v.array("fixedCosts", { max: 20 }, parseFixedCost);
      if (list !== undefined) input.costs.fixedCosts = list;
    }
    issues.push(...v.issues());
  }

  if (input.competition.competitors.reduce((acc, c) => acc + c.share, 0) > 1 + 1e-9) {
    issues.push({ path: `${path}.competition.competitors`, message: "Las cuotas de los competidores suman más del 100 %" });
  }
  const { fixedAssets, workingCapital, deferred, contingencies } = input.investment;
  if (fixedAssets + workingCapital + deferred + contingencies <= 0) {
    issues.push({ path: `${path}.investment`, message: "La inversión total debe ser mayor que cero" });
  }
  return { input, issues };
};

const throwIfIssues = (issues: ValidationIssue[]) => {
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
};

/** POST /financial/simulator/calculate: `{ input }`. */
export const parseSimulatorCalculate = (body: unknown): SimulatorInput => {
  const v = createValidator(body);
  const { input, issues } = readSimulatorInput(objectAt(body, "input"));
  throwIfIssues([...v.issues(), ...issues]);
  return input;
};

export type SaveProjectRequest = { name: string; input: SimulatorInput };
export type UpdateProjectRequest = { name?: string; input: SimulatorInput };

/** POST /financial/projects («Guardar como»): `{ name, input }`. */
export const parseSaveProject = (body: unknown): SaveProjectRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 160 });
  if (!v.has("input")) v.custom("input", "Campo obligatorio");
  const { input, issues } = readSimulatorInput(objectAt(body, "input"));
  throwIfIssues([...v.issues(), ...issues]);
  return { name: name!, input };
};

/** PUT /financial/projects/:id («Guardar proyecto»): `{ name?, input }`. */
export const parseUpdateProject = (body: unknown): UpdateProjectRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 160 }, false);
  if (!v.has("input")) v.custom("input", "Campo obligatorio");
  const { input, issues } = readSimulatorInput(objectAt(body, "input"));
  throwIfIssues([...v.issues(), ...issues]);
  return name === undefined ? { input } : { name, input };
};

export type ProjectScope = "mine" | "all";

/** `?alcance=todos` lista los proyectos de todos los administradores; por omisión, solo los propios. */
export const parseProjectScope = (raw: unknown): ProjectScope => (raw === "todos" || raw === "all" ? "all" : "mine");
