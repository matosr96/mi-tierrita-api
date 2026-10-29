import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RequestHandler } from "express";
import { isDomainError } from "../src/common/errors";
import { npv, irr } from "../src/business-logic/financial/engine";
import { SIMULATOR_DEFAULTS, simulate, type SimulatorInput } from "../src/business-logic/financial/simulator";
import { assertProjectOwner } from "../src/business-logic/financial/find-project";
import {
  parseProjectScope,
  parseSaveProject,
  parseSimulatorCalculate,
  parseUpdateProject,
  readSimulatorInput,
  toProjectDetail,
  toProjectSummary,
  type FinancialProjectRow,
} from "../src/models/simulator";
import { simulatorCalculateController, simulatorDefaultsController } from "../src/controllers/financial/index";
import { financialRouter } from "../src/routes/financial";
import { demoProjects } from "../src/scripts/seed-data";

const near = (actual: number | null | undefined, expected: number, tolerance: number, label: string) => {
  assert.ok(actual !== null && actual !== undefined, `${label}: sin valor`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected} ± ${tolerance}`);
};

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err)) return err.code;
  }
  return undefined;
};

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

const withInput = (patch: (i: SimulatorInput) => void): SimulatorInput => {
  const input = structuredClone(SIMULATOR_DEFAULTS);
  patch(input);
  return input;
};

// ------------------------------------------------------------------ ejemplo del brief ($94,5 M)

test("Mercado y Competencia reproducen el ejemplo: 5.400 al mes, 2,64 % y 6,69 % de cuota", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  assert.equal(r.market.monthlyDemand, 5_400);
  assert.equal(r.market.annualDemand, 64_800);
  near(r.market.gdpTerm, 0.024, 1e-12, "término del PIB");
  near(r.market.unemploymentTerm, 0.0024, 1e-12, "término del desempleo");
  near(r.market.growth, 0.0264, 1e-12, "crecimiento (decisión 1)");
  const [a, b, c] = r.competition.competitors;
  near(a?.captureProbability, 0.38, 1e-12, "Agro Sahagún");
  near(a?.contribution, 0.0399, 1e-12, "aporte Agro Sahagún");
  near(b?.contribution, 0.018, 1e-12, "aporte El Llano");
  near(c?.contribution, 0.009, 1e-12, "aporte del Sinú");
  near(r.competition.marketShare, 0.0669, 1e-12, "cuota total");
  near(r.competition.othersShare, 0.25, 1e-12, "otros");
  near(r.competition.monthlyUnits, 361.26, 0.01, "unidades al mes");
  near(r.competition.annualUnits, 4_335.12, 0.01, "unidades al año");
});

test("Costos por unidades vendidas con IPC y precio automático con margen sobre el costo (decisiones 2 y 5)", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  const [y1, y2] = r.costs.years;
  assert.equal(y1?.fixedTotal, 12_000_000);
  near(y1?.variableTotal, 91_037_520, 1, "variable año 1");
  near(y1?.total, 103_037_520, 1, "total año 1");
  near(r.costs.unitCost, 23_768, 0.5, "costo unitario");
  near(y1?.fixedUnitCost, 2_768, 0.5, "parte fija por unidad");
  near(r.costs.price, 31_849, 0.5, "precio = costo × 1,34");
  near(r.costs.marginOnPrice, 0.254, 0.0005, "margen sobre el precio (informativo)");
  near(y2?.fixedCosts[0]?.amount, 6_943_200, 1e-6, "arriendo año 2");
  near(y2?.variableUnitCost, 22_092, 1e-6, "costo variable unitario año 2");
});

test("Inversión de $94,5 M con depreciación a 10 años y diferidos a 5: cargo anual $7,5 M y valor neto de $31 M", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  assert.equal(r.investment.total, 94_500_000);
  near(r.investment.items[0]?.share, 0.656, 0.001, "activos fijos");
  near(r.investment.items[3]?.share, 0.037, 0.001, "imprevistos");
  assert.equal(r.investment.annualDepreciation, 6_200_000);
  assert.equal(r.investment.annualAmortization, 1_300_000);
  assert.deepEqual(r.investment.schedule.map((s) => s.charge), [7_500_000, 7_500_000, 7_500_000, 7_500_000, 7_500_000]);
  assert.equal(r.investment.schedule[4]?.netBookValue, 31_000_000);
  assert.equal(r.investment.schedule[4]?.deferredNetValue, 0);
  assert.equal(r.cashFlow.years[4]?.salvage, 31_000_000, "salvamento = valor neto en libros");
});

test("Financiación: cuota del brief, resumen anual igual a la suma de los meses y alerta de cobertura", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  const f = r.financing;
  near(f.monthlyRate, 0.016012, 1e-6, "tasa mensual");
  near(f.installment, 2_836_256, 0.5, "cuota 100 % crédito");
  near(f.monthly[0]?.interest, 1_513_122, 0.5, "interés mes 1");
  near(f.monthly[0]?.principal, 1_323_134, 0.5, "abono mes 1");
  near(f.totalInterest, 41_640_276, 1, "intereses totales");
  near(f.afterTaxCostOfDebt, 0.1365, 1e-12, "costo de la deuda después de impuestos");
  assert.equal(f.annual.length, 4);
  for (const year of f.annual) {
    const months = f.monthly.slice((year.year - 1) * 12, year.year * 12);
    near(year.interest + year.principal, year.installments, 1e-4, `año ${year.year}`);
    near(year.installments, months.reduce((acc, m) => acc + m.installment, 0), 1e-6, `cuotas año ${year.year}`);
  }
  near(f.annual[3]?.balance, 0, 1e-4, "saldo final");
  near(f.coverage[0]?.coverage, 0.746, 0.001, "cobertura año 1 = 25,4 / 34,0");
  assert.equal(f.coverage[4]?.coverage, null, "sin cuota en el año 5");
  assert.equal(f.coverageAlert, true);
  const seventy = simulate(withInput((i) => (i.financing.creditPct = 0.7))).financing;
  near(seventy.installment, 1_985_379, 0.5, "cuota 70 %");
  near(seventy.ownContribution, 28_350_000, 1e-6, "aporte propio 70 %");
  near(seventy.debtRatio, 0.7, 1e-12, "barra deuda");
  const own = simulate(withInput((i) => (i.financing.creditPct = 0))).financing;
  assert.equal(own.installment, 0);
  assert.equal(own.coverageAlert, false);
});

test("Flujo de caja: el año 1 deja $25,4 M y con el 2,4 % y el salvamento implícito del ejemplo sale $10,8 M / 22,21 %", () => {
  const old = simulate(withInput((i) => (i.market.unemploymentChange = 0)));
  near(old.market.growth, 0.024, 1e-12, "crecimiento sin el término del desempleo");
  const y1 = old.cashFlow.years[0]!;
  near(y1.revenue, 138_070_277, 1, "ingresos año 1");
  near(y1.ebitda, 35_032_757, 1, "EBITDA año 1");
  near(y1.tax, (35_032_757 - 7_500_000) * 0.35, 1, "impuesto año 1");
  near(y1.freeCashFlow, 25_400_000, 5_000, "flujo libre año 1");
  // El ejemplo del brief usa un salvamento de ≈ $11,47 M (sin origen); con ese ajuste se reproduce exactamente.
  const flows = [...old.cashFlow.flows];
  flows[5] = (flows[5] ?? 0) - 31_000_000 + 11_470_000;
  near(npv(flows, 0.18), 10_800_000, 10_000, "VPN del ejemplo");
  near(irr(flows), 0.2221, 0.0001, "TIR del ejemplo");
});

test("Cifras finales con las decisiones aplicadas (2,64 %, $31.849, salvamento en libros)", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  near(r.indicators.npv, 19_799_000, 5_000, "VPN");
  near(r.indicators.irr, 0.2523, 0.0001, "TIR");
  near(r.indicators.paybackSimple, 3.38, 0.005, "recuperación");
  near(r.indicators.benefitCostRatio, 1.21, 0.001, "B/C");
  near(r.indicators.irrOverCredit, 0.0423, 0.0001, "TIR − tasa del crédito");
  assert.equal(r.cashFlow.flows[0], -94_500_000);
  assert.equal(r.cashFlow.flows.length, 6);
  near(r.cashFlow.years[4]?.netFlow, (r.cashFlow.years[4]?.freeCashFlow ?? 0) + 22_500_000 + 31_000_000, 1e-6, "año 5 con capital de trabajo y salvamento");
});

test("Riesgos: tornado ordenado por amplitud y escenarios pesimista, base y optimista", () => {
  const r = simulate(SIMULATOR_DEFAULTS);
  assert.deepEqual(r.risks.tornado.map((t) => t.variable), ["price", "variableUnitCost", "demand", "discountRate", "inflation"]);
  const by = Object.fromEntries(r.risks.tornado.map((t) => [t.variable, t]));
  near(by["price"]!.npvHigh - r.risks.baseNpv, 32_100_000, 100_000, "precio +10 %");
  near(by["variableUnitCost"]!.npvLow - r.risks.baseNpv, 21_160_000, 100_000, "costo −10 %");
  near(by["demand"]!.npvHigh - r.risks.baseNpv, 10_930_000, 100_000, "demanda +10 % (el precio no se recalcula)");
  near(by["discountRate"]!.lowValue, 0.15, 1e-12, "tasa −3 puntos");
  near(by["inflation"]!.highValue, 0.072, 1e-12, "IPC +2 puntos");
  assert.equal(r.risks.baseNpv, r.indicators.npv);
  const [pes, base, opt] = r.scenarios;
  assert.deepEqual([pes?.key, base?.key, opt?.key], ["pessimistic", "base", "optimistic"]);
  assert.equal(base?.npv, r.indicators.npv, "el escenario base es el mismo cálculo");
  near(pes?.npv, -5_570_000, 10_000, "pesimista");
  near(pes?.irr, 0.1592, 0.0001, "TIR pesimista");
  near(opt?.npv, 48_390_000, 10_000, "optimista");
  near(opt?.irr, 0.353, 0.0001, "TIR optimista");
});

test("Competencia editable: la lista ajusta la demanda y una lista vacía no rompe el cálculo", () => {
  const two = simulate(withInput((i) => i.competition.competitors.pop()));
  near(two.competition.marketShare, 0.0579, 1e-12, "sin Agropecuaria del Sinú");
  assert.ok(two.competition.annualUnits < simulate(SIMULATOR_DEFAULTS).competition.annualUnits);
  const none = simulate(withInput((i) => (i.competition.competitors = [])));
  assert.equal(none.competition.annualUnits, 0);
  assert.equal(none.costs.unitCost, 0);
  assert.ok(Number.isFinite(none.indicators.npv));
  assert.ok(none.indicators.npv < 0, "sin ventas solo se recupera el capital de trabajo y el salvamento");
});

// ------------------------------------------------------------------ validación

test("readSimulatorInput completa con el ejemplo y reemplaza solo lo que llega", () => {
  assert.deepEqual(readSimulatorInput(undefined).input, SIMULATOR_DEFAULTS);
  const { input, issues } = readSimulatorInput({ costs: { marginOnCost: 0.4, fixedCosts: [{ name: "Arriendo", annual: 1 }] }, financing: { creditPct: 0.7 } });
  assert.deepEqual(issues, []);
  assert.equal(input.costs.marginOnCost, 0.4);
  assert.equal(input.costs.variableUnitCost, 21_000);
  assert.deepEqual(input.costs.fixedCosts, [{ name: "Arriendo", annual: 1 }]);
  assert.equal(input.financing.creditPct, 0.7);
  assert.equal(input.financing.termMonths, 48);
  assert.equal(SIMULATOR_DEFAULTS.financing.creditPct, 1, "no muta el ejemplo");
});

test("readSimulatorInput rechaza rangos, cuotas que suman más de 100 % e inversión en cero", () => {
  const paths = readSimulatorInput({
    market: { purchaseIntent: 1.5, population: 10.5 },
    competition: { competitors: [{ name: "A", share: 0.7, satisfaction: 6 }, { name: "", share: 0.5, satisfaction: 2 }] },
    financing: { termMonths: 0 },
  }).issues.map((i) => i.path);
  assert.deepEqual(paths, [
    "input.market.population",
    "input.market.purchaseIntent",
    "input.competition.competitors[0].satisfaction",
    "input.competition.competitors[1].name",
    "input.financing.termMonths",
  ]);
  assert.deepEqual(
    readSimulatorInput({ competition: { competitors: [{ name: "A", share: 0.7, satisfaction: 3 }, { name: "B", share: 0.5, satisfaction: 3 }] } }).issues.map((i) => i.path),
    ["input.competition.competitors"],
  );
  assert.deepEqual(
    readSimulatorInput({ investment: { fixedAssets: 0, workingCapital: 0, deferred: 0, contingencies: 0 } }).issues.map((i) => i.path),
    ["input.investment"],
  );
});

test("parseSaveProject, parseUpdateProject y parseProjectScope", () => {
  assert.deepEqual(paths400(() => parseSaveProject({ name: "" })), ["name", "input"]);
  const saved = parseSaveProject({ name: " Proyecto 70 % ", input: { financing: { creditPct: 0.7 } } });
  assert.equal(saved.name, "Proyecto 70 %");
  assert.equal(saved.input.financing.creditPct, 0.7);
  assert.deepEqual(parseUpdateProject({ input: {} }), { input: SIMULATOR_DEFAULTS });
  assert.equal(parseUpdateProject({ name: "Nuevo", input: {} }).name, "Nuevo");
  assert.deepEqual(paths400(() => parseUpdateProject({ input: { evaluation: { taxRate: 2 } } })), ["input.evaluation.taxRate"]);
  assert.equal(parseProjectScope(undefined), "mine");
  assert.equal(parseProjectScope("todos"), "all");
});

test("Un proyecto guardado muestra las mismas cifras que el simulador (una sola fuente)", () => {
  const input = withInput((i) => (i.financing.creditPct = 0.7));
  const row: FinancialProjectRow = { id: 4, name: "70 %", userId: 1, username: "demo.admin", input, createdAt: new Date("2026-10-29T12:00:00Z"), updatedAt: new Date("2026-10-29T13:00:00Z") };
  const direct = simulate(input);
  const detail = toProjectDetail(row);
  assert.deepEqual(detail.result, direct);
  assert.equal(detail.indicators.npv, direct.indicators.npv);
  assert.equal(detail.indicators.installment, direct.financing.installment);
  const summary = toProjectSummary(row);
  assert.equal(summary.highlights.creditPct, 0.7);
  assert.equal(summary.highlights.totalInvestment, 94_500_000);
  assert.equal(summary.updatedAt, "2026-10-29T13:00:00.000Z");
  assert.equal(codeOf(() => assertProjectOwner(row, 2)), "716");
  assert.equal(codeOf(() => assertProjectOwner(row, 1)), undefined);
});

test("demoProjects: el ejemplo con 100 % y 70 % de crédito, sin tocar los valores por omisión", () => {
  const [full, seventy] = demoProjects();
  assert.ok(full?.name.startsWith("[Demo]") && seventy?.name.startsWith("[Demo]"));
  assert.deepEqual(full?.input, SIMULATOR_DEFAULTS);
  assert.equal(seventy?.input.financing.creditPct, 0.7);
  assert.equal(SIMULATOR_DEFAULTS.financing.creditPct, 1);
});

// ------------------------------------------------------------------ una prueba por endpoint

type Layer = { name: string; handle: RequestHandler; route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler; name: string }[] } };
const layers = financialRouter.stack as unknown as Layer[];

const assertRoute = (method: string, path: string, controller: string) => {
  const layer = layers.find((l) => l.route?.path === path && l.route.methods[method] === true);
  assert.ok(layer?.route, `${method.toUpperCase()} ${path} registrado`);
  assert.equal(layer.route.stack.at(-1)?.name, controller);
};

const fakeRes = () => {
  const res = { statusCode: 200, body: undefined as unknown, status(c: number) { res.statusCode = c; return res; }, json(b: unknown) { res.body = b; return res; } };
  return res;
};

/** Petición con identidad: `requireAuth` la lee por un símbolo privado, así que cualquier símbolo la devuelve. */
const asRole = (role: string): never =>
  new Proxy({}, { get: (_t, key) => (typeof key === "symbol" ? { userId: 1, username: "prueba", role } : undefined) }) as never;

test("Las rutas del simulador nacen protegidas: sin identidad 611 y solo ADMIN", () => {
  const auth = layers[0]!.handle;
  assert.equal(codeOf(() => auth({} as never, {} as never, () => undefined)), "611");
  assert.equal(codeOf(() => auth(asRole("SALES"), {} as never, () => undefined)), "613");
  assert.equal(codeOf(() => auth(asRole("WAREHOUSE"), {} as never, () => undefined)), "613");
  let passed = false;
  auth(asRole("ADMIN"), {} as never, () => (passed = true));
  assert.equal(passed, true);
});

test("GET /financial/simulator/defaults devuelve el ejemplo y su cálculo", () => {
  assertRoute("get", "/simulator/defaults", "simulatorDefaultsController");
  const res = fakeRes();
  simulatorDefaultsController({} as never, res as never, () => undefined);
  const body = res.body as { input: SimulatorInput; result: ReturnType<typeof simulate> };
  assert.deepEqual(body.input, SIMULATOR_DEFAULTS);
  assert.equal(body.result.investment.total, 94_500_000);
});

test("POST /financial/simulator/calculate recalcula sin guardar y valida la entrada", () => {
  assertRoute("post", "/simulator/calculate", "simulatorCalculateController");
  const res = fakeRes();
  simulatorCalculateController({ body: { input: { financing: { creditPct: 0.7 } } } } as never, res as never, () => undefined);
  const body = res.body as { result: ReturnType<typeof simulate> };
  near(body.result.financing.installment, 1_985_379, 0.5, "cuota 70 %");
  assert.deepEqual(paths400(() => parseSimulatorCalculate({ input: { costs: { inflation: 3 } } })), ["input.costs.inflation"]);
});

test("GET /financial/projects lista los del usuario y ?alcance=todos los de todos", () => {
  assertRoute("get", "/projects", "listProjectsController");
});

test("POST /financial/projects guarda como proyecto nuevo", () => {
  assertRoute("post", "/projects", "saveProjectController");
});

test("GET /financial/projects/compare va antes de /:id", () => {
  assertRoute("get", "/projects/compare", "compareProjectsController");
  const compareAt = layers.findIndex((l) => l.route?.path === "/projects/compare");
  const byIdAt = layers.findIndex((l) => l.route?.path === "/projects/:id");
  assert.ok(compareAt < byIdAt);
});

test("GET, PUT y DELETE /financial/projects/:id", () => {
  assertRoute("get", "/projects/:id", "getProjectController");
  assertRoute("put", "/projects/:id", "updateProjectController");
  assertRoute("delete", "/projects/:id", "deleteProjectController");
});
