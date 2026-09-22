import { createValidator, isIsoDate } from "../common/validate";
import {
  BASE_ASSUMPTIONS,
  SENSITIVITY_VARIABLES,
  type Assumptions,
  type Range,
  type ScenarioInput,
  type ScenarioResult,
  type SensitivityVariable,
} from "../business-logic/financial/engine";

export type FinancialScenarioRow = {
  id: number;
  name: string;
  userId: number;
  username: string;
  fixedInvestment: number;
  creditPct: number;
  termMonths: number;
  salesIncreasePct: number;
  additionalExpensesMonth: number;
  creditCoversWorkingCapital: boolean;
  baseAssumptions: Assumptions;
  results: ScenarioResult;
  createdAt: Date;
  updatedAt: Date;
};

/** Indicadores resumidos, los mismos de la Tabla 7 del capítulo 5. */
export type ScenarioIndicators = {
  workingCapital: number;
  totalInvestment: number;
  credit: number;
  ownContribution: number;
  installment: number;
  totalInterest: number;
  npv: number;
  irr: number | null;
  paybackSimple: number | null;
  paybackDiscounted: number | null;
  profitabilityIndex: number;
  benefitCostRatio: number;
  investorNpv: number;
  investorIrr: number | null;
  coverageWithSales: number | null;
  coverageWithoutSales: number | null;
  coverageIncremental: number | null;
  signChanges: number;
};

export type ScenarioSummaryResponse = {
  id: number;
  name: string;
  userId: number;
  username: string;
  fixedInvestment: number;
  creditPct: number;
  termMonths: number;
  salesIncrease: number;
  additionalExpensesMonth: number;
  creditCoversWorkingCapital: boolean;
  indicators: ScenarioIndicators;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioDetailResponse = ScenarioSummaryResponse & {
  assumptions: Assumptions;
  results: Omit<ScenarioResult, "amortization">;
};

export const toScenarioIndicators = (r: ScenarioResult): ScenarioIndicators => ({
  workingCapital: r.workingCapital,
  totalInvestment: r.totalInvestment,
  credit: r.credit,
  ownContribution: r.ownContribution,
  installment: r.installment,
  totalInterest: r.totalInterest,
  npv: r.npv,
  irr: r.irr,
  paybackSimple: r.paybackSimple,
  paybackDiscounted: r.paybackDiscounted,
  profitabilityIndex: r.profitabilityIndex,
  benefitCostRatio: r.benefitCostRatio,
  investorNpv: r.investorNpv,
  investorIrr: r.investorIrr,
  coverageWithSales: r.coverageWithSales,
  coverageWithoutSales: r.coverageWithoutSales,
  coverageIncremental: r.coverageIncremental,
  signChanges: r.signChanges,
});

export const toScenarioSummary = (row: FinancialScenarioRow): ScenarioSummaryResponse => ({
  id: row.id,
  name: row.name,
  userId: row.userId,
  username: row.username,
  fixedInvestment: row.fixedInvestment,
  creditPct: row.creditPct,
  termMonths: row.termMonths,
  salesIncrease: row.salesIncreasePct,
  additionalExpensesMonth: row.additionalExpensesMonth,
  creditCoversWorkingCapital: row.creditCoversWorkingCapital,
  indicators: toScenarioIndicators(row.results),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toScenarioDetail = (row: FinancialScenarioRow): ScenarioDetailResponse => {
  const { amortization: _amortization, ...results } = row.results;
  return { ...toScenarioSummary(row), assumptions: row.baseAssumptions, results };
};

/** Reconstruye la entrada del motor desde la fila guardada (para sensibilidad y tornado). */
export const toScenarioInput = (row: FinancialScenarioRow): ScenarioInput => ({
  fixedInvestment: row.fixedInvestment,
  creditPct: row.creditPct,
  termMonths: row.termMonths,
  salesIncrease: row.salesIncreasePct,
  additionalExpensesMonth: row.additionalExpensesMonth,
  creditCoversWorkingCapital: row.creditCoversWorkingCapital,
  assumptions: row.baseAssumptions,
});

/** CU-14 / RF-06.1: supuestos del escenario; los base son opcionales y parten de BASE_ASSUMPTIONS. */
export type CreateScenarioRequest = { name: string; input: ScenarioInput };

const PCT = { min: 0, max: 1 };
const MONEY = { min: 0, max: 1e13 };

export const parseCreateScenario = (body: unknown): CreateScenarioRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 160 });
  const fixedInvestment = v.number("fixedInvestment", MONEY);
  const creditPct = v.number("creditPct", PCT);
  const termMonths = v.number("termMonths", { integer: true, min: 1, max: 360 });
  const salesIncrease = v.number("salesIncrease", { min: 0, max: 10 });
  const additionalExpensesMonth = v.number("additionalExpensesMonth", MONEY);
  const creditCoversWorkingCapital = v.boolean("creditCoversWorkingCapital", false) ?? false;

  const assumptions: Assumptions = { ...BASE_ASSUMPTIONS };
  const rawAssumptions: unknown = typeof body === "object" && body !== null ? (body as Record<string, unknown>)["assumptions"] : undefined;
  if (rawAssumptions !== undefined && rawAssumptions !== null) {
    const a = createValidator(rawAssumptions, "assumptions");
    const rules: Record<keyof Assumptions, { min: number; max: number; integer?: boolean }> = {
      monthlySales: MONEY,
      costOfSalesPct: { min: 0, max: 0.999 },
      fixedExpensesMonth: MONEY,
      baseSalesGrowth: { min: -1, max: 5 },
      constructionInvestment: MONEY,
      equipmentInvestment: MONEY,
      salesIncreasePct: { min: 0, max: 10 },
      additionalFixedExpensesMonth: MONEY,
      inventoryTurnover: { min: 0.01, max: 365 },
      creditRateEA: { min: 0, max: 5 },
      termMonths: { min: 1, max: 360, integer: true },
      tmarEA: { min: 0, max: 5 },
      investorRateEA: { min: 0, max: 5 },
      horizonYears: { min: 1, max: 50, integer: true },
      inflation: { min: -1, max: 5 },
      salvageValuePct: PCT,
      ownerWithdrawalsMonth: MONEY,
    };
    for (const key of Object.keys(rules) as (keyof Assumptions)[]) {
      const value = a.number(key, rules[key], false);
      if (value !== undefined) assumptions[key] = value;
    }
    v.issues().push(...a.issues());
  }
  v.done();
  return {
    name: name!,
    input: {
      fixedInvestment: fixedInvestment!,
      creditPct: creditPct!,
      termMonths: termMonths!,
      salesIncrease: salesIncrease!,
      additionalExpensesMonth: additionalExpensesMonth!,
      creditCoversWorkingCapital,
      assumptions,
    },
  };
};

const toNumber = (raw: unknown): number | undefined => {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

export const isSensitivityVariable = (raw: unknown): raw is SensitivityVariable =>
  typeof raw === "string" && (SENSITIVITY_VARIABLES as readonly string[]).includes(raw);

/** ?from=&to=&step= completos → rango; ninguno → undefined (rango por defecto); parcial → null (inválido). */
export const parseRangeQuery = (query: Record<string, unknown>, suffix = ""): Range | undefined | null => {
  const from = toNumber(query[`from${suffix}`]);
  const to = toNumber(query[`to${suffix}`]);
  const step = toNumber(query[`step${suffix}`]);
  if (from === undefined && to === undefined && step === undefined) return undefined;
  if (from === undefined || to === undefined || step === undefined) return null;
  return { from, to, step };
};

/** ?ids=1,2,3 → [1,2,3] sin repetidos; inválido → undefined. */
export const parseIdsQuery = (raw: unknown): number[] | undefined => {
  if (typeof raw !== "string") return undefined;
  const ids = raw.split(",").map((s) => Number(s.trim()));
  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n) || n <= 0)) return undefined;
  return [...new Set(ids)];
};

export { isIsoDate };
