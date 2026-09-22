/**
 * Motor de evaluación económica de la ampliación de Mi Tierrita (capítulo 5 del TCC).
 *
 * Es una transcripción fiel de `3 Modelo economico/1 Motor de calculo.py` (versión 2.0-corregida):
 * módulo puro, sin Express, sin SQL ni E/S. Se conserva el orden de las operaciones en coma
 * flotante para que los resultados coincidan con `2 Resultados del modelo.json`.
 *
 * Nota sobre la procedencia de cada bloque:
 *  - `monthlyRate`, `installment`, `amortizationTable`, `npv`, `irr`, `payback`, `signChanges`
 *    y `calculateScenario` reproducen una a una las funciones del script Python.
 *  - El script Python NO contiene funciones de sensibilidad, bivariante ni tornado; las de aquí
 *    reconstruyen las tablas 8 a 12 del capítulo 5 (`3 Tablas del capitulo 5.md`) aplicando el
 *    mismo `calculateScenario` con una variable modificada a la vez (dos en la bivariante).
 */

// ---------------------------------------------------------------------------
// Supuestos base (Tabla 1)
// ---------------------------------------------------------------------------

export type Assumptions = {
  monthlySales: number; // ventas_mes
  costOfSalesPct: number; // costo_ventas_pct
  fixedExpensesMonth: number; // gastos_fijos_mes
  baseSalesGrowth: number; // crec_ventas_base
  constructionInvestment: number; // inversion_obra
  equipmentInvestment: number; // inversion_dotacion
  salesIncreasePct: number; // incremento_ventas_pct
  additionalFixedExpensesMonth: number; // gastos_fijos_adic_mes
  inventoryTurnover: number; // rotacion_inventario (veces por año)
  creditRateEA: number; // tasa_credito_ea
  termMonths: number; // plazo_meses
  tmarEA: number; // tmar_ea
  investorRateEA: number; // tasa_inversionista_ea
  horizonYears: number; // horizonte_anios
  inflation: number; // inflacion
  salvageValuePct: number; // valor_salvamento_pct
  ownerWithdrawalsMonth: number; // retiros_propietaria_mes
};

/** Valores exactos del diccionario `BASE` del script Python. */
export const BASE_ASSUMPTIONS: Assumptions = {
  monthlySales: 65_000_000,
  costOfSalesPct: 0.75,
  fixedExpensesMonth: 8_500_000,
  baseSalesGrowth: 0.03,
  constructionInvestment: 60_000_000,
  equipmentInvestment: 15_000_000,
  salesIncreasePct: 0.2,
  additionalFixedExpensesMonth: 1_000_000,
  inventoryTurnover: 6.0,
  creditRateEA: 0.21,
  termMonths: 48,
  tmarEA: 0.18,
  investorRateEA: 0.18,
  horizonYears: 5,
  inflation: 0.05,
  salvageValuePct: 0.3,
  ownerWithdrawalsMonth: 0,
};

// ---------------------------------------------------------------------------
// Tipos del escenario
// ---------------------------------------------------------------------------

export type ScenarioInput = {
  fixedInvestment: number; // inversion_fija
  creditPct: number; // pct_credito (0..1)
  termMonths: number; // plazo_meses
  salesIncrease: number; // incremento_ventas
  additionalExpensesMonth: number; // gastos_adic_mes
  creditCoversWorkingCapital: boolean; // credito_cubre_capital_trabajo
  assumptions: Assumptions;
};

/**
 * Fila del detalle anual del flujo del proyecto. Igual que en el Python, `expenses` se guarda
 * con signo negativo (es un egreso) y `workingCapitalDelta` es el negativo del incremento del
 * inventario del año; `flow = margin + expenses + workingCapitalDelta + salvage + workingCapitalRecovery`.
 */
export type CashFlowDetail = {
  year: number;
  margin: number;
  expenses: number;
  workingCapitalDelta: number;
  salvage: number;
  workingCapitalRecovery: number;
  flow: number;
};

export type AmortizationRow = { month: number; installment: number; interest: number; principal: number; balance: number };

export type ScenarioResult = {
  fixedInvestment: number;
  workingCapital: number;
  totalInvestment: number;
  credit: number;
  ownContribution: number;
  termMonths: number;
  salesIncrease: number;
  additionalExpensesMonth: number;
  installment: number;
  totalInterest: number;
  flows: number[];
  detail: CashFlowDetail[];
  debtService: number[];
  npv: number;
  irr: number | null;
  paybackSimple: number | null;
  paybackDiscounted: number | null;
  profitabilityIndex: number;
  benefitCostRatio: number;
  investorFlows: number[];
  investorNpv: number;
  investorIrr: number | null;
  coverageWithSales: number | null;
  coverageWithoutSales: number | null;
  coverageIncremental: number | null;
  signChanges: number;
  amortization: AmortizationRow[];
};

// ---------------------------------------------------------------------------
// Funciones financieras
// ---------------------------------------------------------------------------

/** Tasa mensual equivalente a una efectiva anual: (1 + ea)^(1/12) - 1. */
export const monthlyRate = (ea: number): number => (1 + ea) ** (1 / 12) - 1;

/** Cuota fija de un crédito en sistema francés; 0 si no hay capital prestado. */
export const installment = (principal: number, i: number, n: number): number =>
  principal > 0 ? (principal * i) / (1 - (1 + i) ** -n) : 0.0;

/** Tabla de amortización mensual. El saldo publicado nunca es negativo (residuo de redondeo). */
export const amortizationTable = (
  principal: number,
  monthlyRateValue: number,
  months: number,
): { installment: number; rows: AmortizationRow[] } => {
  const cuota = installment(principal, monthlyRateValue, months);
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m += 1) {
    const interest = balance * monthlyRateValue;
    const abono = cuota - interest;
    balance -= abono;
    rows.push({ month: m, installment: cuota, interest, principal: abono, balance: Math.max(balance, 0.0) });
  }
  return { installment: cuota, rows };
};

/** Valor presente neto de una serie de flujos anuales (t = 0, 1, 2, ...). */
export const npv = (flows: number[], rate: number): number =>
  flows.reduce((acc, f, t) => acc + f / (1 + rate) ** t, 0);

/**
 * Tasa interna de retorno por bisección en [-0.9999, 10] con 400 iteraciones, exactamente como
 * el script. Devuelve `null` si el VPN no cambia de signo en el intervalo.
 */
export const irr = (flows: number[]): number | null => {
  let lo = -0.9999;
  let hi = 10.0;
  if (npv(flows, lo) * npv(flows, hi) > 0) return null;
  for (let k = 0; k < 400; k += 1) {
    const m = (lo + hi) / 2;
    if (npv(flows, lo) * npv(flows, m) <= 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
};

/**
 * Periodo de recuperación en años con interpolación lineal dentro del año en que el acumulado
 * cambia de signo. Con `rate = 0` es el simple; con la TMAR, el descontado. `null` si nunca se recupera.
 */
export const payback = (flows: number[], rate = 0.0): number | null => {
  let acum = flows[0] ?? 0;
  for (let t = 1; t < flows.length; t += 1) {
    const previo = acum;
    const desc = (flows[t] ?? 0) / (1 + rate) ** t;
    acum += desc;
    if (acum >= 0) return t - 1 + -previo / desc;
  }
  return null;
};

/** Número de cambios de signo de la serie (criterio de unicidad de la TIR). */
const signChangesOf = (flows: number[]): number => {
  let count = 0;
  for (let k = 1; k < flows.length; k += 1) {
    if ((flows[k] ?? 0) * (flows[k - 1] ?? 0) < 0) count += 1;
  }
  return count;
};

// ---------------------------------------------------------------------------
// Escenario
// ---------------------------------------------------------------------------

/** Equivalente de `Escenario.calcular()` del script Python. */
export const calculateScenario = (input: ScenarioInput): ScenarioResult => {
  const s = input.assumptions;
  const H = s.horizonYears;
  const mg = 1 - s.costOfSalesPct;
  const g = s.baseSalesGrowth;
  const inf = s.inflation;
  const iM = monthlyRate(s.creditRateEA);

  // --- capital de trabajo: inventario que exigen las ventas adicionales ---
  const ventasAdA1 = s.monthlySales * input.salesIncrease * 12;
  const cogsAdA1 = ventasAdA1 * s.costOfSalesPct;
  const wc: number[] = [];
  for (let t = 0; t < H; t += 1) wc.push((cogsAdA1 * (1 + g) ** t) / s.inventoryTurnover);
  const wcInicial = wc[0] ?? 0;
  const wcIncrementos: number[] = [];
  for (let t = 1; t < H; t += 1) wcIncrementos.push((wc[t] ?? 0) - (wc[t - 1] ?? 0));
  const wcTotal = wc[wc.length - 1] ?? 0;

  const totalInvestment = input.fixedInvestment + wcInicial;
  let credit = input.fixedInvestment * input.creditPct;
  if (input.creditCoversWorkingCapital) credit += wcInicial;

  const { installment: cuota, rows } = amortizationTable(credit, iM, input.termMonths);
  const debtService: number[] = [];
  for (let y = 0; y < H; y += 1) {
    debtService.push(rows.slice(y * 12, (y + 1) * 12).reduce((acc, f) => acc + f.installment, 0));
  }

  // --- flujo del proyecto ---
  const margenA1 = ventasAdA1 * mg;
  const flows: number[] = [-totalInvestment];
  const detail: CashFlowDetail[] = [];
  for (let y = 1; y <= H; y += 1) {
    const margen = margenA1 * (1 + g) ** (y - 1);
    const gastos = input.additionalExpensesMonth * 12 * (1 + inf) ** (y - 1);
    const dwc = y - 1 < wcIncrementos.length ? -(wcIncrementos[y - 1] ?? 0) : 0.0;
    const salv = y === H ? input.fixedInvestment * s.salvageValuePct : 0.0;
    const recWc = y === H ? wcTotal : 0.0;
    const f = margen - gastos + dwc + salv + recWc;
    flows.push(f);
    detail.push({
      year: y,
      margin: margen,
      expenses: -gastos,
      workingCapitalDelta: dwc,
      salvage: salv,
      workingCapitalRecovery: recWc,
      flow: f,
    });
  }

  const r = s.tmarEA;
  const ri = s.investorRateEA;

  // --- indicadores ---
  const vpBeneficios = detail.reduce(
    (acc, d) => acc + (d.margin + d.salvage + d.workingCapitalRecovery) / (1 + r) ** d.year,
    0,
  );
  const vpCostosOp = detail.reduce((acc, d) => acc + (-d.expenses - d.workingCapitalDelta) / (1 + r) ** d.year, 0);

  // --- flujo del inversionista ---
  const ownContribution = totalInvestment - credit;
  const investorFlows: number[] = [-ownContribution];
  for (let y = 1; y <= H; y += 1) {
    investorFlows.push((flows[y] ?? 0) - (y - 1 < debtService.length ? (debtService[y - 1] ?? 0) : 0.0));
  }

  // --- coberturas ---
  const utilActual = s.monthlySales * mg - s.fixedExpensesMonth - s.ownerWithdrawalsMonth;
  const utilCon = utilActual + s.monthlySales * input.salesIncrease * mg - input.additionalExpensesMonth;
  const first = detail[0];
  const flujoIncrementalMes = first ? (first.margin + first.expenses) / 12 : 0;

  const projectNpv = npv(flows, r);

  return {
    fixedInvestment: input.fixedInvestment,
    workingCapital: wcInicial,
    totalInvestment,
    credit,
    ownContribution,
    termMonths: input.termMonths,
    salesIncrease: input.salesIncrease,
    additionalExpensesMonth: input.additionalExpensesMonth,
    installment: cuota,
    totalInterest: rows.reduce((acc, f) => acc + f.interest, 0),
    flows,
    detail,
    debtService,
    npv: projectNpv,
    irr: irr(flows),
    paybackSimple: payback(flows),
    paybackDiscounted: payback(flows, r),
    profitabilityIndex: (projectNpv + totalInvestment) / totalInvestment,
    benefitCostRatio: vpBeneficios / (totalInvestment + vpCostosOp),
    investorFlows,
    investorNpv: npv(investorFlows, ri),
    investorIrr: irr(investorFlows),
    coverageWithSales: cuota ? utilCon / cuota : null,
    coverageWithoutSales: cuota ? utilActual / cuota : null,
    coverageIncremental: cuota ? flujoIncrementalMes / cuota : null,
    signChanges: signChangesOf(flows),
    amortization: rows,
  };
};

// ---------------------------------------------------------------------------
// Sensibilidad, bivariante y tornado (tablas 8 a 12)
// ---------------------------------------------------------------------------

export const SENSITIVITY_VARIABLES = ["salesIncrease", "inventoryTurnover", "tmar"] as const;
export type SensitivityVariable = (typeof SENSITIVITY_VARIABLES)[number];
export type Range = { from: number; to: number; step: number };

/**
 * Variables del tornado (Tabla 11) y su correspondencia con los campos del escenario:
 *  - grossMargin             -> 1 - assumptions.costOfSalesPct (se mueve el margen, no el costo)
 *  - salesIncrease           -> input.salesIncrease
 *  - fixedInvestment         -> input.fixedInvestment
 *  - tmar                    -> assumptions.tmarEA
 *  - additionalExpensesMonth -> input.additionalExpensesMonth
 *  - inventoryTurnover       -> assumptions.inventoryTurnover
 *  - salvageValuePct         -> assumptions.salvageValuePct
 *  - creditRateEA            -> assumptions.creditRateEA (amplitud cero sobre el VPN del proyecto)
 */
export const TORNADO_VARIABLES = [
  "grossMargin",
  "salesIncrease",
  "fixedInvestment",
  "tmar",
  "additionalExpensesMonth",
  "inventoryTurnover",
  "salvageValuePct",
  "creditRateEA",
] as const;
export type TornadoVariable = (typeof TORNADO_VARIABLES)[number];

/**
 * Rangos por omisión de la bivariante. El script Python no define una malla; estos cubren los
 * valores de las tablas 8, 9, 10 y 12 (12 %..28 % de ventas, 4..12 rotaciones, 14 %..24 % de TMAR).
 */
export const DEFAULT_SENSITIVITY_RANGES: Record<SensitivityVariable, Range> = {
  salesIncrease: { from: 0.12, to: 0.28, step: 0.04 },
  inventoryTurnover: { from: 4, to: 12, step: 2 },
  tmar: { from: 0.14, to: 0.24, step: 0.02 },
};

/** Valor actual de una variable del tornado en el escenario. */
const readVariable = (input: ScenarioInput, variable: TornadoVariable): number => {
  switch (variable) {
    case "grossMargin":
      return 1 - input.assumptions.costOfSalesPct;
    case "salesIncrease":
      return input.salesIncrease;
    case "fixedInvestment":
      return input.fixedInvestment;
    case "tmar":
      return input.assumptions.tmarEA;
    case "additionalExpensesMonth":
      return input.additionalExpensesMonth;
    case "inventoryTurnover":
      return input.assumptions.inventoryTurnover;
    case "salvageValuePct":
      return input.assumptions.salvageValuePct;
    case "creditRateEA":
      return input.assumptions.creditRateEA;
  }
};

/** Copia del escenario con una variable reemplazada (nunca muta la entrada). */
const withVariable = (input: ScenarioInput, variable: TornadoVariable, value: number): ScenarioInput => {
  switch (variable) {
    case "grossMargin":
      return { ...input, assumptions: { ...input.assumptions, costOfSalesPct: 1 - value } };
    case "salesIncrease":
      return { ...input, salesIncrease: value };
    case "fixedInvestment":
      return { ...input, fixedInvestment: value };
    case "tmar":
      return { ...input, assumptions: { ...input.assumptions, tmarEA: value } };
    case "additionalExpensesMonth":
      return { ...input, additionalExpensesMonth: value };
    case "inventoryTurnover":
      return { ...input, assumptions: { ...input.assumptions, inventoryTurnover: value } };
    case "salvageValuePct":
      return { ...input, assumptions: { ...input.assumptions, salvageValuePct: value } };
    case "creditRateEA":
      return { ...input, assumptions: { ...input.assumptions, creditRateEA: value } };
  }
};

/** Puntos de un rango cerrado [from, to] con paso `step`; lanza "650" si el rango es inválido. */
const rangePoints = (range: Range): number[] => {
  const { from, to, step } = range;
  if (!(step > 0) || !(from <= to) || !Number.isFinite(from) || !Number.isFinite(to)) throw new Error("650");
  const count = Math.floor((to - from) / step + 1e-9) + 1;
  const points: number[] = [];
  for (let k = 0; k < count; k += 1) points.push(Number((from + k * step).toPrecision(12)));
  return points;
};

/** Sensibilidad univariante (tablas 8, 9 y 10): VPN y TIR del proyecto para cada valor de la variable. */
export const sensitivity = (
  input: ScenarioInput,
  variable: SensitivityVariable,
  range: Range,
): { variable: SensitivityVariable; points: { value: number; npv: number; irr: number | null }[] } => {
  const points = rangePoints(range).map((value) => {
    const result = calculateScenario(withVariable(input, variable, value));
    return { value, npv: result.npv, irr: result.irr };
  });
  return { variable, points };
};

/** Sensibilidad bivariante (Tabla 12): malla de VPN indexada como `npv[yIndex][xIndex]`. */
export const bivariateSensitivity = (
  input: ScenarioInput,
  varX: SensitivityVariable,
  varY: SensitivityVariable,
  rangeX: Range = DEFAULT_SENSITIVITY_RANGES[varX],
  rangeY: Range = DEFAULT_SENSITIVITY_RANGES[varY],
): { varX: SensitivityVariable; varY: SensitivityVariable; xValues: number[]; yValues: number[]; npv: number[][] } => {
  const xValues = rangePoints(rangeX);
  const yValues = rangePoints(rangeY);
  const grid = yValues.map((y) =>
    xValues.map((x) => calculateScenario(withVariable(withVariable(input, varX, x), varY, y)).npv),
  );
  return { varX, varY, xValues, yValues, npv: grid };
};

/**
 * Diagrama de tornado (Tabla 11): cada variable movida ±`delta` (20 % por omisión) sobre su valor
 * en el escenario, con las demás fijas. `low`/`high` son los valores de la variable evaluados y la
 * lista queda ordenada por amplitud descendente.
 */
export const tornado = (
  input: ScenarioInput,
  delta = 0.2,
): { variable: string; low: number; high: number; npvLow: number; npvHigh: number; amplitude: number }[] => {
  const rows = TORNADO_VARIABLES.map((variable) => {
    const base = readVariable(input, variable);
    const low = base * (1 - delta);
    const high = base * (1 + delta);
    const npvLow = calculateScenario(withVariable(input, variable, low)).npv;
    const npvHigh = calculateScenario(withVariable(input, variable, high)).npv;
    return { variable, low, high, npvLow, npvHigh, amplitude: Math.abs(npvHigh - npvLow) };
  });
  return rows.sort((a, b) => b.amplitude - a.amplitude);
};

// ---------------------------------------------------------------------------
// Escenarios del capítulo 5
// ---------------------------------------------------------------------------

/**
 * Escenarios A, B y C de `escenarios()` del script y el D que solo aparece en el JSON de
 * resultados (crédito que cubre obra, dotación e inventario). Para pruebas y ejemplos.
 */
export const PRESET_SCENARIOS: { name: string; input: ScenarioInput }[] = [
  {
    name: "A. Ampliación completa, crédito 100 % a 48 meses",
    input: {
      fixedInvestment: 75_000_000,
      creditPct: 1.0,
      termMonths: 48,
      salesIncrease: 0.2,
      additionalExpensesMonth: 1_000_000,
      creditCoversWorkingCapital: false,
      assumptions: BASE_ASSUMPTIONS,
    },
  },
  {
    name: "B. Ampliación completa, crédito 70 % + aporte propio 30 %",
    input: {
      fixedInvestment: 75_000_000,
      creditPct: 0.7,
      termMonths: 48,
      salesIncrease: 0.2,
      additionalExpensesMonth: 1_000_000,
      creditCoversWorkingCapital: false,
      assumptions: BASE_ASSUMPTIONS,
    },
  },
  {
    name: "C. Solo obra (60 M), crédito 100 % a 36 meses",
    input: {
      fixedInvestment: 60_000_000,
      creditPct: 1.0,
      termMonths: 36,
      salesIncrease: 0.13,
      additionalExpensesMonth: 700_000,
      creditCoversWorkingCapital: false,
      assumptions: BASE_ASSUMPTIONS,
    },
  },
  {
    name: "D. Crédito cubre obra, dotación e inventario",
    input: {
      fixedInvestment: 75_000_000,
      creditPct: 1.0,
      termMonths: 48,
      salesIncrease: 0.2,
      additionalExpensesMonth: 1_000_000,
      creditCoversWorkingCapital: true,
      assumptions: BASE_ASSUMPTIONS,
    },
  },
];
