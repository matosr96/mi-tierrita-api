import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  PRESET_SCENARIOS,
  BASE_ASSUMPTIONS,
  amortizationTable,
  bivariateSensitivity,
  calculateScenario,
  monthlyRate,
  sensitivity,
  tornado,
  type ScenarioInput,
} from "../src/business-logic/financial/engine";

const RESULTS_PATH =
  "/Users/matosrv96/Desktop/TCC Ingenieria Economica/3 Modelo economico/2 Resultados del modelo.json";

type PythonDetail = {
  anio: number;
  margen: number;
  gastos: number;
  delta_wc: number;
  salvamento: number;
  recupero_wc: number;
  flujo: number;
};
type PythonScenario = {
  escenario: string;
  inversion_fija: number;
  capital_trabajo: number;
  inversion_total: number;
  credito: number;
  aporte_propio: number;
  plazo: number;
  incremento_ventas: number;
  gastos_adic_mes: number;
  cuota: number;
  intereses: number;
  flujos: number[];
  detalle: PythonDetail[];
  servicio_deuda: number[];
  VPN: number;
  TIR: number | null;
  payback_simple: number | null;
  payback_descontado: number | null;
  indice_rentabilidad: number;
  BC_convencional: number;
  flujo_inversionista: number[];
  VPN_inv: number;
  TIR_inv: number | null;
  cobertura_con_ventas: number | null;
  cobertura_sin_ventas: number | null;
  cobertura_incremental: number | null;
  cambios_signo: number;
  amortizacion_mensual: { mes: number; cuota: number; interes: number; abono: number; saldo: number }[];
};
type PythonResults = { supuestos: Record<string, number>; resultados: PythonScenario[] };

const results: PythonResults | null = existsSync(RESULTS_PATH)
  ? (JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as PythonResults)
  : null;
const skipReason = results ? false : `no existe ${RESULTS_PATH}`;

/** Igualdad numérica: relativa 1e-6, o absoluta 1e-3 cuando el valor esperado está cerca de cero. */
const close = (actual: number | null, expected: number | null, label: string, relTol = 1e-6, absTol = 1e-3) => {
  if (expected === null || actual === null) {
    assert.equal(actual, expected, `${label}: se esperaba ${expected} y se obtuvo ${actual}`);
    return;
  }
  const tol = Math.abs(expected) < 1 ? absTol : Math.abs(expected) * relTol;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: se esperaba ${expected} y se obtuvo ${actual} (diferencia ${actual - expected})`,
  );
};

const closeArray = (actual: number[], expected: number[], label: string) => {
  assert.equal(actual.length, expected.length, `${label}: longitud`);
  expected.forEach((e, i) => close(actual[i] ?? Number.NaN, e, `${label}[${i}]`));
};

const scenarioA = (): ScenarioInput => {
  const preset = PRESET_SCENARIOS[0];
  assert.ok(preset);
  return preset.input;
};

// ---------------------------------------------------------------------------
// Equivalencia con el JSON de resultados del modelo Python
// ---------------------------------------------------------------------------

test("los supuestos base coinciden con el JSON del modelo", { skip: skipReason }, () => {
  const s = results!.supuestos;
  assert.equal(BASE_ASSUMPTIONS.monthlySales, s["ventas_mes"]);
  assert.equal(BASE_ASSUMPTIONS.costOfSalesPct, s["costo_ventas_pct"]);
  assert.equal(BASE_ASSUMPTIONS.fixedExpensesMonth, s["gastos_fijos_mes"]);
  assert.equal(BASE_ASSUMPTIONS.baseSalesGrowth, s["crec_ventas_base"]);
  assert.equal(BASE_ASSUMPTIONS.constructionInvestment, s["inversion_obra"]);
  assert.equal(BASE_ASSUMPTIONS.equipmentInvestment, s["inversion_dotacion"]);
  assert.equal(BASE_ASSUMPTIONS.salesIncreasePct, s["incremento_ventas_pct"]);
  assert.equal(BASE_ASSUMPTIONS.additionalFixedExpensesMonth, s["gastos_fijos_adic_mes"]);
  assert.equal(BASE_ASSUMPTIONS.inventoryTurnover, s["rotacion_inventario"]);
  assert.equal(BASE_ASSUMPTIONS.creditRateEA, s["tasa_credito_ea"]);
  assert.equal(BASE_ASSUMPTIONS.termMonths, s["plazo_meses"]);
  assert.equal(BASE_ASSUMPTIONS.tmarEA, s["tmar_ea"]);
  assert.equal(BASE_ASSUMPTIONS.investorRateEA, s["tasa_inversionista_ea"]);
  assert.equal(BASE_ASSUMPTIONS.horizonYears, s["horizonte_anios"]);
  assert.equal(BASE_ASSUMPTIONS.inflation, s["inflacion"]);
  assert.equal(BASE_ASSUMPTIONS.salvageValuePct, s["valor_salvamento_pct"]);
  assert.equal(BASE_ASSUMPTIONS.ownerWithdrawalsMonth, s["retiros_propietaria_mes"]);
});

test("calculateScenario reproduce cada escenario del JSON del modelo", { skip: skipReason }, () => {
  const expectedScenarios = results!.resultados;
  assert.equal(PRESET_SCENARIOS.length, expectedScenarios.length, "número de escenarios");

  expectedScenarios.forEach((expected, i) => {
    const preset = PRESET_SCENARIOS[i];
    assert.ok(preset, `falta el escenario ${i}`);
    assert.equal(preset.name, expected.escenario);
    const r = calculateScenario(preset.input);
    const tag = `escenario ${expected.escenario.slice(0, 1)}`;

    close(r.fixedInvestment, expected.inversion_fija, `${tag} inversion_fija`);
    close(r.workingCapital, expected.capital_trabajo, `${tag} capital_trabajo`);
    close(r.totalInvestment, expected.inversion_total, `${tag} inversion_total`);
    close(r.credit, expected.credito, `${tag} credito`);
    close(r.ownContribution, expected.aporte_propio, `${tag} aporte_propio`);
    assert.equal(r.termMonths, expected.plazo, `${tag} plazo`);
    close(r.salesIncrease, expected.incremento_ventas, `${tag} incremento_ventas`);
    close(r.additionalExpensesMonth, expected.gastos_adic_mes, `${tag} gastos_adic_mes`);
    close(r.installment, expected.cuota, `${tag} cuota`);
    close(r.totalInterest, expected.intereses, `${tag} intereses`);
    close(r.npv, expected.VPN, `${tag} VPN`);
    close(r.irr, expected.TIR, `${tag} TIR`);
    close(r.paybackSimple, expected.payback_simple, `${tag} payback_simple`);
    close(r.paybackDiscounted, expected.payback_descontado, `${tag} payback_descontado`);
    close(r.profitabilityIndex, expected.indice_rentabilidad, `${tag} indice_rentabilidad`);
    close(r.benefitCostRatio, expected.BC_convencional, `${tag} BC_convencional`);
    close(r.investorNpv, expected.VPN_inv, `${tag} VPN_inv`);
    close(r.investorIrr, expected.TIR_inv, `${tag} TIR_inv`);
    close(r.coverageWithSales, expected.cobertura_con_ventas, `${tag} cobertura_con_ventas`);
    close(r.coverageWithoutSales, expected.cobertura_sin_ventas, `${tag} cobertura_sin_ventas`);
    close(r.coverageIncremental, expected.cobertura_incremental, `${tag} cobertura_incremental`);
    assert.equal(r.signChanges, expected.cambios_signo, `${tag} cambios_signo`);

    closeArray(r.flows, expected.flujos, `${tag} flujos`);
    closeArray(r.investorFlows, expected.flujo_inversionista, `${tag} flujo_inversionista`);
    closeArray(r.debtService, expected.servicio_deuda, `${tag} servicio_deuda`);

    assert.equal(r.detail.length, expected.detalle.length, `${tag} detalle`);
    expected.detalle.forEach((d, y) => {
      const got = r.detail[y];
      assert.ok(got);
      assert.equal(got.year, d.anio);
      close(got.margin, d.margen, `${tag} detalle[${y}].margen`);
      close(got.expenses, d.gastos, `${tag} detalle[${y}].gastos`);
      close(got.workingCapitalDelta, d.delta_wc, `${tag} detalle[${y}].delta_wc`);
      close(got.salvage, d.salvamento, `${tag} detalle[${y}].salvamento`);
      close(got.workingCapitalRecovery, d.recupero_wc, `${tag} detalle[${y}].recupero_wc`);
      close(got.flow, d.flujo, `${tag} detalle[${y}].flujo`);
    });

    // La tabla mensual del JSON está redondeada a 2 decimales: tolerancia absoluta de un centavo.
    assert.equal(r.amortization.length, expected.amortizacion_mensual.length, `${tag} amortizacion`);
    expected.amortizacion_mensual.forEach((row, m) => {
      const got = r.amortization[m];
      assert.ok(got);
      assert.equal(got.month, row.mes);
      for (const [key, value] of [
        ["installment", row.cuota],
        ["interest", row.interes],
        ["principal", row.abono],
        ["balance", row.saldo],
      ] as const) {
        assert.ok(Math.abs(got[key] - value) <= 0.0051, `${tag} amortizacion[${m}].${key}: ${got[key]} vs ${value}`);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Funciones auxiliares
// ---------------------------------------------------------------------------

test("amortizationTable termina con saldo cero y suma de abonos igual al capital", () => {
  const { installment, rows } = amortizationTable(75_000_000, monthlyRate(0.21), 48);
  assert.equal(rows.length, 48);
  const last = rows[rows.length - 1];
  assert.ok(last);
  assert.ok(Math.abs(last.balance) < 1e-6, `saldo final ${last.balance}`);
  const principalPaid = rows.reduce((acc, r) => acc + r.principal, 0);
  assert.ok(Math.abs(principalPaid - 75_000_000) < 1e-3);
  assert.ok(installment > 0);
  assert.equal(amortizationTable(0, monthlyRate(0.21), 48).installment, 0);
});

// ---------------------------------------------------------------------------
// Sensibilidad (tablas 8, 9 y 10 del capítulo 5, cifras redondeadas a pesos y a 0,01 %)
// ---------------------------------------------------------------------------

const closePesos = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual} vs ${expected}`);
const closeRate = (actual: number | null, expected: number, label: string) =>
  assert.ok(actual !== null && Math.abs(actual - expected) <= 6e-5, `${label}: ${actual} vs ${expected}`);

test("sensitivity devuelve un punto por valor del rango y reproduce la Tabla 8 (ventas)", () => {
  const { variable, points } = sensitivity(scenarioA(), "salesIncrease", { from: 0.12, to: 0.28, step: 0.04 });
  assert.equal(variable, "salesIncrease");
  assert.deepEqual(
    points.map((p) => p.value),
    [0.12, 0.16, 0.2, 0.24, 0.28],
  );
  const expected: [number, number, number][] = [
    [0.12, -35_951_936, 0.0162],
    [0.16, -12_610_371, 0.1273],
    [0.2, 10_731_195, 0.2217],
    [0.24, 34_072_760, 0.3041],
    [0.28, 57_414_326, 0.3775],
  ];
  expected.forEach(([value, vpn, tir], i) => {
    const p = points[i];
    assert.ok(p);
    assert.equal(p.value, value);
    closePesos(p.npv, vpn, `VPN ventas ${value}`);
    closeRate(p.irr, tir, `TIR ventas ${value}`);
  });
  assert.equal(sensitivity(scenarioA(), "tmar", { from: 0.18, to: 0.18, step: 0.01 }).points.length, 1);
  assert.equal(sensitivity(scenarioA(), "tmar", { from: 0.14, to: 0.24, step: 0.02 }).points.length, 6);
});

test("sensitivity reproduce la Tabla 9 (rotación) y la Tabla 10 (TMAR)", () => {
  const rotation = sensitivity(scenarioA(), "inventoryTurnover", { from: 4, to: 6, step: 1 }).points;
  const expectedRotation: [number, number, number][] = [
    [4, 4_959_929, 0.1972],
    [5, 8_422_688, 0.2112],
    [6, 10_731_195, 0.2217],
  ];
  expectedRotation.forEach(([value, vpn, tir], i) => {
    const p = rotation[i];
    assert.ok(p);
    assert.equal(p.value, value);
    closePesos(p.npv, vpn, `VPN rotación ${value}`);
    closeRate(p.irr, tir, `TIR rotación ${value}`);
  });
  closePesos(sensitivity(scenarioA(), "inventoryTurnover", { from: 12, to: 12, step: 1 }).points[0]!.npv, 16_502_461, "VPN rotación 12");

  const tmar = sensitivity(scenarioA(), "tmar", { from: 0.14, to: 0.24, step: 0.02 }).points;
  const expectedTmar: [number, number][] = [
    [0.14, 22_935_454],
    [0.16, 16_574_239],
    [0.18, 10_731_195],
    [0.2, 5_353_740],
    [0.22, 5_353_740], // marcador: se reemplaza abajo (la tabla usa 22,17 %, no 22 %)
    [0.24, -4_184_403],
  ];
  expectedTmar.forEach(([value, vpn], i) => {
    const p = tmar[i];
    assert.ok(p);
    assert.equal(p.value, value);
    if (value !== 0.22) closePesos(p.npv, vpn, `VPN TMAR ${value}`);
  });
  // La TIR es la TMAR que anula el VPN: en 22,17 % la tabla muestra -7.940.
  closePesos(sensitivity(scenarioA(), "tmar", { from: 0.2217, to: 0.2217, step: 1 }).points[0]!.npv, -7_940, "VPN TMAR 22,17 %");
});

test("sensitivity rechaza rangos inválidos con el código 650", () => {
  for (const range of [
    { from: 0.1, to: 0.2, step: 0 },
    { from: 0.1, to: 0.2, step: -0.1 },
    { from: 0.3, to: 0.2, step: 0.1 },
    { from: Number.NaN, to: 0.2, step: 0.1 },
  ]) {
    assert.throws(() => sensitivity(scenarioA(), "salesIncrease", range), (err: unknown) => err instanceof Error && err.message === "650");
  }
  assert.throws(() => bivariateSensitivity(scenarioA(), "salesIncrease", "tmar", { from: 1, to: 0, step: 1 }), /650/);
});

// ---------------------------------------------------------------------------
// Bivariante (Tabla 12, VPN en millones con un decimal)
// ---------------------------------------------------------------------------

test("bivariateSensitivity produce la malla npv[y][x] y reproduce la Tabla 12", () => {
  const grid = bivariateSensitivity(
    scenarioA(),
    "inventoryTurnover",
    "salesIncrease",
    { from: 4, to: 8, step: 2 },
    { from: 0.16, to: 0.24, step: 0.04 },
  );
  assert.equal(grid.varX, "inventoryTurnover");
  assert.equal(grid.varY, "salesIncrease");
  assert.deepEqual(grid.xValues, [4, 6, 8]);
  assert.deepEqual(grid.yValues, [0.16, 0.2, 0.24]);
  assert.equal(grid.npv.length, 3);
  grid.npv.forEach((row) => assert.equal(row.length, 3));

  // Filas: ventas 16 %, 20 %, 24 %; columnas: rotación 4, 6, 8.
  const expectedMillions = [
    [-17.2, -12.6, -10.3],
    [5.0, 10.7, 13.6],
    [27.1, 34.1, 37.5],
  ];
  expectedMillions.forEach((row, yi) =>
    row.forEach((millions, xi) => {
      const got = grid.npv[yi]?.[xi];
      assert.ok(got !== undefined);
      assert.ok(Math.abs(got / 1e6 - millions) <= 0.06, `npv[${yi}][${xi}] ${got / 1e6} vs ${millions}`);
    }),
  );

  // Rangos por omisión: 5 ventas x 5 rotaciones.
  const byDefault = bivariateSensitivity(scenarioA(), "salesIncrease", "inventoryTurnover");
  assert.equal(byDefault.xValues.length, 5);
  assert.equal(byDefault.yValues.length, 5);
  assert.equal(byDefault.npv.length, 5);
  assert.ok(byDefault.npv.every((row) => row.length === 5));
  // Simetría: la celda (x=20 %, y=6) vale lo mismo que el caso base.
  closePesos(byDefault.npv[1]![2]!, calculateScenario(scenarioA()).npv, "celda base");
});

// ---------------------------------------------------------------------------
// Tornado (Tabla 11)
// ---------------------------------------------------------------------------

test("tornado ordena por amplitud descendente y reproduce la Tabla 11", () => {
  const rows = tornado(scenarioA());
  assert.equal(rows.length, 8);
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i - 1]!.amplitude >= rows[i]!.amplitude, "orden por amplitud");
  }
  assert.deepEqual(
    rows.map((r) => r.variable),
    ["grossMargin", "salesIncrease", "fixedInvestment", "tmar", "additionalExpensesMonth", "inventoryTurnover", "salvageValuePct", "creditRateEA"],
  );

  const expected: Record<string, [number, number]> = {
    grossMargin: [-15_688_379, 37_150_769],
    salesIncrease: [-12_610_371, 34_072_760],
    fixedInvestment: [23_764_203, -2_301_814],
    tmar: [21_618_999, 1_355_666],
    additionalExpensesMonth: [18_893_513, 2_568_877],
    inventoryTurnover: [7_845_562, 12_654_950],
    salvageValuePct: [8_764_203, 12_698_186],
    creditRateEA: [10_731_195, 10_731_195],
  };
  for (const row of rows) {
    const [low, high] = expected[row.variable]!;
    closePesos(row.npvLow, low, `${row.variable} -20 %`);
    closePesos(row.npvHigh, high, `${row.variable} +20 %`);
    assert.ok(Math.abs(row.amplitude - Math.abs(high - low)) <= 2, `${row.variable} amplitud`);
  }
  const margin = rows.find((r) => r.variable === "grossMargin")!;
  assert.ok(Math.abs(margin.low - 0.2) < 1e-12 && Math.abs(margin.high - 0.3) < 1e-12);
  assert.equal(rows.find((r) => r.variable === "creditRateEA")!.amplitude, 0);

  // Un delta distinto cambia los extremos evaluados.
  const wide = tornado(scenarioA(), 0.5).find((r) => r.variable === "salesIncrease")!;
  assert.ok(Math.abs(wide.low - 0.1) < 1e-12 && Math.abs(wide.high - 0.3) < 1e-12);
});
