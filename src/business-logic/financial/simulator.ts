/**
 * Simulador financiero por unidades (Ingeniería Económica, sección 3 del brief de Karina): siete secciones en
 * cadena —Mercado → Competencia → Costos → Inversión → Financiación → Flujo de caja → Riesgos— más los escenarios
 * pesimista, base y optimista. Módulo puro: sin Express, sin SQL ni E/S.
 *
 * Es la única fuente de las cifras del simulador: la pantalla de Finanzas, el informe PDF/Excel y «Exportar
 * escenario» muestran lo que devuelve `simulate`. Reutiliza las funciones financieras del motor del capítulo 5
 * (`npv`, `irr`, `payback`, `monthlyRate`, `amortizationTable`).
 *
 * Decisiones aplicadas (`DECISIONES-FASE-B.md`):
 *  1. Crecimiento = PIB × sensibilidad PIB + variación del desempleo × sensibilidad del desempleo (2,64 %).
 *  2. Precio = costo unitario × (1 + margen sobre el costo); el margen sobre el precio es informativo.
 *  3. Una sola fuente: este módulo.
 *  4. VPN sobre el flujo libre del proyecto (sin deuda) a la tasa mínima exigida; el crédito solo entra en
 *     Financiación y en la cobertura.
 *  5. Costos por unidades vendidas (Mi Tierrita comercializa, no fabrica).
 * Más la del 29/10/2026: el salvamento del año final es el valor neto en libros de los activos fijos.
 *
 * Convenciones que reproducen el ejemplo de $94,5 M del brief: los costos fijos y el costo variable unitario suben
 * con el IPC desde el año 2; el precio se fija con el costo unitario del año 1 y desde el año 2 sube con el IPC.
 */
import { amortizationTable, irr, monthlyRate, npv, payback, type AmortizationRow } from "./engine";

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type Competitor = { name: string; share: number; satisfaction: number };
export type FixedCost = { name: string; annual: number };

export type SimulatorInput = {
  market: {
    population: number; // población objetivo (personas)
    purchaseIntent: number; // disposición a comprar (0..1)
    consumptionPerPerson: number; // unidades por persona al mes
    gdpGrowth: number; // crecimiento del PIB (fracción)
    gdpSensitivity: number; // sensibilidad de la demanda al PIB
    unemploymentChange: number; // variación del desempleo (fracción: −0,2 puntos = −0,002)
    unemploymentSensitivity: number; // sensibilidad de la demanda al desempleo
  };
  competition: {
    competitors: Competitor[]; // cuota (0..1) y satisfacción (0..5) de cada competidor
    conversionFactor: number; // fracción de los clientes insatisfechos que se logra convertir
  };
  costs: {
    fixedCosts: FixedCost[]; // costos fijos del año 1 (pesos al año)
    variableUnitCost: number; // costo variable por unidad vendida en el año 1
    inflation: number; // IPC anual
    marginOnCost: number; // margen sobre el costo para el precio automático
  };
  investment: {
    fixedAssets: number; // local, estantería, equipos
    workingCapital: number; // inventario y caja
    deferred: number; // licencias, permisos, estudios
    contingencies: number; // imprevistos
    depreciationYears: number; // vida útil de los activos fijos (línea recta)
    deferredAmortizationYears: number; // años para amortizar los diferidos
  };
  financing: {
    creditPct: number; // parte de la inversión con crédito (0..1)
    creditRateEA: number; // tasa efectiva anual del crédito
    termMonths: number;
  };
  evaluation: {
    horizonYears: number;
    discountRate: number; // tasa mínima exigida (efectiva anual)
    taxRate: number;
  };
};

/** Ejemplo de la ampliación del local del brief (cifras de ejemplo, no del negocio real). */
export const SIMULATOR_DEFAULTS: SimulatorInput = {
  market: {
    population: 12_000,
    purchaseIntent: 0.45,
    consumptionPerPerson: 1,
    gdpGrowth: 0.03,
    gdpSensitivity: 0.8,
    unemploymentChange: -0.002,
    unemploymentSensitivity: -1.2,
  },
  competition: {
    competitors: [
      { name: "Agro Sahagún", share: 0.35, satisfaction: 3.1 },
      { name: "Veterinaria El Llano", share: 0.25, satisfaction: 3.8 },
      { name: "Agropecuaria del Sinú", share: 0.15, satisfaction: 4.0 },
    ],
    conversionFactor: 0.3,
  },
  costs: {
    fixedCosts: [
      { name: "Arriendo y servicios", annual: 6_600_000 },
      { name: "Nómina adicional", annual: 5_400_000 },
    ],
    variableUnitCost: 21_000,
    inflation: 0.052,
    marginOnCost: 0.34,
  },
  investment: {
    fixedAssets: 62_000_000,
    workingCapital: 22_500_000,
    deferred: 6_500_000,
    contingencies: 3_500_000,
    depreciationYears: 10,
    deferredAmortizationYears: 5,
  },
  financing: { creditPct: 1, creditRateEA: 0.21, termMonths: 48 },
  evaluation: { horizonYears: 5, discountRate: 0.18, taxRate: 0.35 },
};

/** Satisfacción máxima de la escala de la encuesta (1 a 5). */
export const SATISFACTION_SCALE = 5;

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type CompetitorResult = Competitor & { captureProbability: number; contribution: number };

export type CostYear = {
  year: number;
  units: number;
  fixedCosts: { name: string; amount: number }[];
  fixedTotal: number;
  variableUnitCost: number;
  variableTotal: number;
  total: number;
  fixedUnitCost: number;
  unitCost: number;
};

export type InvestmentItem = { key: "fixedAssets" | "workingCapital" | "deferred" | "contingencies"; label: string; amount: number; share: number };

export type DepreciationYear = { year: number; depreciation: number; amortization: number; charge: number; netBookValue: number; deferredNetValue: number };

export type FinancingYear = { year: number; installments: number; interest: number; principal: number; balance: number };

export type CoverageYear = { year: number; freeCashFlow: number; debtService: number; coverage: number | null };

export type CashFlowYear = {
  year: number;
  units: number;
  price: number;
  revenue: number;
  fixedCosts: number;
  variableCosts: number;
  ebitda: number;
  depreciationAmortization: number;
  taxableIncome: number;
  tax: number;
  freeCashFlow: number;
  workingCapitalRecovery: number;
  salvage: number;
  netFlow: number;
};

export type Indicators = {
  npv: number;
  irr: number | null;
  paybackSimple: number | null;
  paybackDiscounted: number | null;
  benefitCostRatio: number;
};

export const TORNADO_KEYS = ["price", "variableUnitCost", "demand", "discountRate", "inflation"] as const;
export type SimulatorTornadoKey = (typeof TORNADO_KEYS)[number];

export type TornadoBar = {
  variable: SimulatorTornadoKey;
  label: string;
  change: string; // «±10 %», «±3 puntos»
  lowValue: number;
  highValue: number;
  npvLow: number;
  npvHigh: number;
  amplitude: number;
};

export type ScenarioKey = "pessimistic" | "base" | "optimistic";

export type ScenarioRow = Indicators & { key: ScenarioKey; label: string; demandChange: number; priceChange: number };

export type SimulatorResult = {
  market: {
    monthlyDemand: number;
    annualDemand: number;
    gdpTerm: number;
    unemploymentTerm: number;
    growth: number;
    years: { year: number; demand: number }[];
  };
  competition: {
    competitors: CompetitorResult[];
    othersShare: number;
    marketShare: number;
    monthlyUnits: number;
    annualUnits: number;
  };
  costs: {
    years: CostYear[];
    unitCost: number;
    price: number;
    marginOnCost: number;
    marginOnPrice: number;
  };
  investment: {
    items: InvestmentItem[];
    total: number;
    annualDepreciation: number;
    annualAmortization: number;
    schedule: DepreciationYear[];
  };
  financing: {
    credit: number;
    ownContribution: number;
    debtRatio: number;
    equityRatio: number;
    creditRateEA: number;
    monthlyRate: number;
    termMonths: number;
    installment: number;
    totalInterest: number;
    afterTaxCostOfDebt: number;
    monthly: AmortizationRow[];
    annual: FinancingYear[];
    coverage: CoverageYear[];
    minCoverage: number | null;
    coverageAlert: boolean;
  };
  cashFlow: { years: CashFlowYear[]; flows: number[] };
  indicators: Indicators & { discountRate: number; taxRate: number; irrOverCredit: number | null };
  risks: { baseNpv: number; tornado: TornadoBar[] };
  scenarios: ScenarioRow[];
};

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

/**
 * Ajustes que usan el tornado y los escenarios (multiplicadores sobre el caso base). El precio automático siempre
 * sale del caso base: un choque de demanda no lo recalcula, y `basePrice` lo fija cuando se mueve el costo variable.
 */
type Shocks = { demandFactor: number; priceFactor: number; basePrice?: number };
const NO_SHOCKS: Shocks = { demandFactor: 1, priceFactor: 1 };

/** Núcleo de las secciones 1 a 6 (sin tornado ni escenarios, que lo llaman a su vez). */
const core = (input: SimulatorInput, shocks: Shocks = NO_SHOCKS) => {
  const { market: m, competition: c, costs: k, investment: inv, financing: f, evaluation: e } = input;
  const H = e.horizonYears;
  const ipc = (year: number) => (1 + k.inflation) ** (year - 1);

  // 1. Mercado
  const monthlyDemand = m.population * m.purchaseIntent * m.consumptionPerPerson;
  const annualDemand = monthlyDemand * 12;
  const gdpTerm = m.gdpGrowth * m.gdpSensitivity;
  const unemploymentTerm = m.unemploymentChange * m.unemploymentSensitivity;
  const growth = gdpTerm + unemploymentTerm;
  const demandOf = (year: number) => annualDemand * (1 + growth) ** (year - 1);

  // 2. Competencia
  const competitors: CompetitorResult[] = c.competitors.map((x) => {
    const captureProbability = 1 - x.satisfaction / SATISFACTION_SCALE;
    return { ...x, captureProbability, contribution: x.share * captureProbability * c.conversionFactor };
  });
  const marketShare = competitors.reduce((acc, x) => acc + x.contribution, 0);
  const othersShare = Math.max(0, 1 - c.competitors.reduce((acc, x) => acc + x.share, 0));
  const unitsOf = (year: number) => demandOf(year) * marketShare * shocks.demandFactor;

  // 3. Costos (unidades vendidas) y precio automático
  const costYears: CostYear[] = [];
  for (let y = 1; y <= H; y += 1) {
    const units = unitsOf(y);
    const fixedCosts = k.fixedCosts.map((x) => ({ name: x.name, amount: x.annual * ipc(y) }));
    const fixedTotal = fixedCosts.reduce((acc, x) => acc + x.amount, 0);
    const variableUnitCost = k.variableUnitCost * ipc(y);
    const variableTotal = variableUnitCost * units;
    const total = fixedTotal + variableTotal;
    costYears.push({
      year: y,
      units,
      fixedCosts,
      fixedTotal,
      variableUnitCost,
      variableTotal,
      total,
      fixedUnitCost: units > 0 ? fixedTotal / units : 0,
      unitCost: units > 0 ? total / units : 0,
    });
  }
  const unitCost = costYears[0]?.unitCost ?? 0;
  const baseUnits = demandOf(1) * marketShare;
  const baseUnitCost = baseUnits > 0 ? (k.fixedCosts.reduce((acc, x) => acc + x.annual, 0) + k.variableUnitCost * baseUnits) / baseUnits : 0;
  const basePrice = shocks.basePrice ?? baseUnitCost * (1 + k.marginOnCost);
  const price = basePrice * shocks.priceFactor;

  // 4. Inversión, depreciación y amortización
  const total = inv.fixedAssets + inv.workingCapital + inv.deferred + inv.contingencies;
  const share = (v: number) => (total > 0 ? v / total : 0);
  const items: InvestmentItem[] = [
    { key: "fixedAssets", label: "Activos fijos (local, estantería, equipos)", amount: inv.fixedAssets, share: share(inv.fixedAssets) },
    { key: "workingCapital", label: "Capital de trabajo (inventario y caja)", amount: inv.workingCapital, share: share(inv.workingCapital) },
    { key: "deferred", label: "Diferidos (licencias, permisos, estudios)", amount: inv.deferred, share: share(inv.deferred) },
    { key: "contingencies", label: "Imprevistos", amount: inv.contingencies, share: share(inv.contingencies) },
  ];
  const annualDepreciation = inv.fixedAssets / inv.depreciationYears;
  const annualAmortization = inv.deferred / inv.deferredAmortizationYears;
  const schedule: DepreciationYear[] = [];
  for (let y = 1; y <= H; y += 1) {
    const depreciation = y <= inv.depreciationYears ? annualDepreciation : 0;
    const amortization = y <= inv.deferredAmortizationYears ? annualAmortization : 0;
    schedule.push({
      year: y,
      depreciation,
      amortization,
      charge: depreciation + amortization,
      netBookValue: Math.max(0, inv.fixedAssets - annualDepreciation * Math.min(y, inv.depreciationYears)),
      deferredNetValue: Math.max(0, inv.deferred - annualAmortization * Math.min(y, inv.deferredAmortizationYears)),
    });
  }
  const salvage = schedule[H - 1]?.netBookValue ?? 0;

  // 6. Flujo de caja libre del proyecto (sin deuda)
  const cashYears: CashFlowYear[] = [];
  const flows: number[] = [-total];
  for (let y = 1; y <= H; y += 1) {
    const cost = costYears[y - 1]!;
    const yearPrice = price * ipc(y);
    const revenue = cost.units * yearPrice;
    const ebitda = revenue - cost.fixedTotal - cost.variableTotal;
    const da = schedule[y - 1]!.charge;
    const taxableIncome = ebitda - da;
    const tax = Math.max(0, taxableIncome) * e.taxRate;
    const freeCashFlow = ebitda - tax;
    const workingCapitalRecovery = y === H ? inv.workingCapital : 0;
    const yearSalvage = y === H ? salvage : 0;
    const netFlow = freeCashFlow + workingCapitalRecovery + yearSalvage;
    flows.push(netFlow);
    cashYears.push({
      year: y,
      units: cost.units,
      price: yearPrice,
      revenue,
      fixedCosts: cost.fixedTotal,
      variableCosts: cost.variableTotal,
      ebitda,
      depreciationAmortization: da,
      taxableIncome,
      tax,
      freeCashFlow,
      workingCapitalRecovery,
      salvage: yearSalvage,
      netFlow,
    });
  }
  const projectNpv = npv(flows, e.discountRate);
  const indicators: Indicators = {
    npv: projectNpv,
    irr: irr(flows),
    paybackSimple: payback(flows),
    paybackDiscounted: payback(flows, e.discountRate),
    benefitCostRatio: total > 0 ? (projectNpv + total) / total : 0,
  };

  return {
    market: { monthlyDemand, annualDemand, gdpTerm, unemploymentTerm, growth, years: costYears.map((x) => ({ year: x.year, demand: demandOf(x.year) })) },
    competition: { competitors, othersShare, marketShare, monthlyUnits: monthlyDemand * marketShare, annualUnits: annualDemand * marketShare },
    costs: { years: costYears, unitCost, price: basePrice, marginOnCost: k.marginOnCost, marginOnPrice: basePrice > 0 ? (basePrice - unitCost) / basePrice : 0 },
    investment: { items, total, annualDepreciation, annualAmortization, schedule },
    cashFlow: { years: cashYears, flows },
    indicators,
    financingInput: f,
  };
};

/** 5. Financiación: crédito en sistema francés, resumen anual y cobertura con el flujo libre de cada año. */
const financing = (input: SimulatorInput, total: number, cashYears: CashFlowYear[]): SimulatorResult["financing"] => {
  const f = input.financing;
  const credit = total * f.creditPct;
  const iM = monthlyRate(f.creditRateEA);
  const { installment, rows } = amortizationTable(credit, iM, f.termMonths);
  const annual: FinancingYear[] = [];
  for (let y = 1; y <= Math.ceil(f.termMonths / 12); y += 1) {
    const slice = rows.slice((y - 1) * 12, y * 12);
    annual.push({
      year: y,
      installments: slice.reduce((acc, r) => acc + r.installment, 0),
      interest: slice.reduce((acc, r) => acc + r.interest, 0),
      principal: slice.reduce((acc, r) => acc + r.principal, 0),
      balance: slice[slice.length - 1]?.balance ?? 0,
    });
  }
  const coverage: CoverageYear[] = cashYears.map((c) => {
    const debtService = annual[c.year - 1]?.installments ?? 0;
    return { year: c.year, freeCashFlow: c.freeCashFlow, debtService, coverage: debtService > 0 ? c.freeCashFlow / debtService : null };
  });
  const withDebt = coverage.map((c) => c.coverage).filter((v): v is number => v !== null);
  const minCoverage = withDebt.length > 0 ? Math.min(...withDebt) : null;
  return {
    credit,
    ownContribution: total - credit,
    debtRatio: total > 0 ? credit / total : 0,
    equityRatio: total > 0 ? (total - credit) / total : 0,
    creditRateEA: f.creditRateEA,
    monthlyRate: iM,
    termMonths: f.termMonths,
    installment,
    totalInterest: rows.reduce((acc, r) => acc + r.interest, 0),
    afterTaxCostOfDebt: f.creditRateEA * (1 - input.evaluation.taxRate),
    monthly: rows,
    annual,
    coverage,
    minCoverage,
    coverageAlert: minCoverage !== null && minCoverage < 1,
  };
};

/** Variables del tornado (sección 7 del brief) con su cambio a la baja y al alza. */
const TORNADO_SPECS: { variable: SimulatorTornadoKey; label: string; change: string; read: (i: SimulatorInput) => number; move: (dir: -1 | 1) => (i: SimulatorInput) => { input: SimulatorInput; shocks: Shocks; value: number } }[] = [
  {
    variable: "price",
    label: "Precio de venta",
    change: "±10 %",
    read: () => 1,
    move: (dir) => (i) => ({ input: i, shocks: { demandFactor: 1, priceFactor: 1 + dir * 0.1 }, value: 1 + dir * 0.1 }),
  },
  {
    variable: "variableUnitCost",
    label: "Costo variable",
    change: "±10 %",
    read: (i) => i.costs.variableUnitCost,
    move: (dir) => (i) => {
      const value = i.costs.variableUnitCost * (1 + dir * 0.1);
      // Solo se mueve el costo: el precio queda en el del caso base.
      return { input: { ...i, costs: { ...i.costs, variableUnitCost: value } }, shocks: { demandFactor: 1, priceFactor: 1, basePrice: core(i).costs.price }, value };
    },
  },
  {
    variable: "demand",
    label: "Demanda",
    change: "±10 %",
    read: () => 1,
    move: (dir) => (i) => ({ input: i, shocks: { demandFactor: 1 + dir * 0.1, priceFactor: 1 }, value: 1 + dir * 0.1 }),
  },
  {
    variable: "discountRate",
    label: "Tasa mínima exigida",
    change: "±3 puntos",
    read: (i) => i.evaluation.discountRate,
    move: (dir) => (i) => {
      const value = i.evaluation.discountRate + dir * 0.03;
      return { input: { ...i, evaluation: { ...i.evaluation, discountRate: value } }, shocks: NO_SHOCKS, value };
    },
  },
  {
    variable: "inflation",
    label: "IPC",
    change: "±2 puntos",
    read: (i) => i.costs.inflation,
    move: (dir) => (i) => {
      const value = i.costs.inflation + dir * 0.02;
      return { input: { ...i, costs: { ...i.costs, inflation: value } }, shocks: NO_SHOCKS, value };
    },
  },
];

/**
 * 7. Tornado: cada variable se mueve por separado (las demás quedan fijas) y se mide el VPN.
 * El precio y el costo variable se mueven sin recalcular el otro: un precio −10 % no baja el costo, y un costo
 * variable +10 % no sube el precio. La lista queda ordenada por amplitud descendente.
 */
export const simulatorTornado = (input: SimulatorInput): TornadoBar[] =>
  TORNADO_SPECS.map((spec) => {
    const low = spec.move(-1)(input);
    const high = spec.move(1)(input);
    const npvLow = core(low.input, low.shocks).indicators.npv;
    const npvHigh = core(high.input, high.shocks).indicators.npv;
    return { variable: spec.variable, label: spec.label, change: spec.change, lowValue: low.value, highValue: high.value, npvLow, npvHigh, amplitude: Math.abs(npvHigh - npvLow) };
  }).sort((a, b) => b.amplitude - a.amplitude);

/** Escenarios del brief: pesimista (demanda −10 %, precio −5 %), base y optimista (demanda +10 %, precio +5 %). */
export const SCENARIO_SPECS: { key: ScenarioKey; label: string; demandChange: number; priceChange: number }[] = [
  { key: "pessimistic", label: "Pesimista", demandChange: -0.1, priceChange: -0.05 },
  { key: "base", label: "Base", demandChange: 0, priceChange: 0 },
  { key: "optimistic", label: "Optimista", demandChange: 0.1, priceChange: 0.05 },
];

export const simulatorScenarios = (input: SimulatorInput): ScenarioRow[] =>
  SCENARIO_SPECS.map((s) => ({ ...s, ...core(input, { demandFactor: 1 + s.demandChange, priceFactor: 1 + s.priceChange }).indicators }));

/** Calcula todas las secciones del simulador para una entrada ya validada. */
export const simulate = (input: SimulatorInput): SimulatorResult => {
  const base = core(input);
  const { financingInput: _f, ...sections } = base;
  return {
    ...sections,
    financing: financing(input, base.investment.total, base.cashFlow.years),
    indicators: {
      ...base.indicators,
      discountRate: input.evaluation.discountRate,
      taxRate: input.evaluation.taxRate,
      irrOverCredit: base.indicators.irr === null ? null : base.indicators.irr - input.financing.creditRateEA,
    },
    risks: { baseNpv: base.indicators.npv, tornado: simulatorTornado(input) },
    scenarios: simulatorScenarios(input),
  };
};
