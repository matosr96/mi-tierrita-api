/**
 * Datos de ejemplo de Mi Tierrita (brief de octubre de 2026, punto 39): funciones puras, sin base de datos ni red,
 * que describen una agropecuaria de Sahagún (Córdoba). `seed.ts` las convierte en registros usando la lógica de
 * negocio real; aquí solo se decide QUÉ crear, de forma determinista (la misma lista en cada ejecución) para que el
 * seed sea idempotente y las pruebas no dependan de la base.
 *
 * Marca de los datos demo (sin columnas nuevas): usuarios `demo.*`, SKU `DEMO-…`, NIT de proveedores y documento de
 * clientes `DEMO-…`, escenarios `[Demo] …`, correos de contacto `@ejemplo.demo`. Las ventas, abonos, mensajes y
 * exportaciones demo son las que firman los usuarios `demo.*`.
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { addDaysIso } from "../common/dates";
import { PRODUCT_LINES, type ProductLine } from "../business-logic/categories/product-lines";
import { BASE_ASSUMPTIONS, type ScenarioInput } from "../business-logic/financial/engine";
import { SIMULATOR_DEFAULTS, type SimulatorInput } from "../business-logic/financial/simulator";
import type { ExportFormat, ExportReport, ExportData } from "../models/exports";
import type { PaymentType } from "../models/sales";
import type { Role } from "../security/roles";

/** Clave de los tres usuarios demo (documentada en el README). */
export const DEMO_PASSWORD = "Demo-2026";

/** Prefijo que marca SKU, NIT y documentos de ejemplo. */
export const DEMO_PREFIX = "DEMO-";

/** Días de historial de ventas que cubre el seed. */
export const SALES_DAYS = 120;

/* ---------- aleatoriedad determinista ---------- */

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da siempre la misma secuencia. */
export const createRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const between = (rng: () => number, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Instante en la hora del negocio (Córdoba, UTC−5) a partir de una fecha YYYY-MM-DD y una hora HH:MM. */
export const atBusinessTime = (isoDate: string, hour: number, minute: number): Date =>
  new Date(`${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`);

/* ---------- usuarios ---------- */

export type DemoUser = { username: string; firstName: string; lastName: string; role: Role; email: string; phone: string };

export const demoUsers = (): DemoUser[] => [
  { username: "demo.admin", firstName: "Karina", lastName: "Demo", role: "ADMIN", email: "demo.admin@ejemplo.demo", phone: "3104567890" },
  { username: "demo.caja", firstName: "Luisa", lastName: "Demo", role: "SALES", email: "demo.caja@ejemplo.demo", phone: "3115678901" },
  { username: "demo.bodega", firstName: "Jairo", lastName: "Demo", role: "WAREHOUSE", email: "demo.bodega@ejemplo.demo", phone: "3126789012" },
];

/* ---------- catálogo ---------- */

/** Las seis líneas de la página pública (código, nombre, descripción y subfamilias): la misma lista que la migración 0018. */
export const demoLines = (): readonly ProductLine[] => PRODUCT_LINES;

/** Nombres de las seis líneas, en el orden del catálogo. */
export const demoCategories = (): string[] => PRODUCT_LINES.map((l) => l.name);

export type DemoSupplier = { name: string; taxId: string; phone: string };

export const demoSuppliers = (): DemoSupplier[] => [
  { name: "Concentrados del Sinú S.A.S.", taxId: `${DEMO_PREFIX}900101001`, phone: "6047850011" },
  { name: "Agroveterinaria Montería Ltda.", taxId: `${DEMO_PREFIX}900101002`, phone: "6047850022" },
  { name: "Semillas y Abonos del Caribe", taxId: `${DEMO_PREFIX}900101003`, phone: "6047850033" },
  { name: "Incubadora San Jerónimo", taxId: `${DEMO_PREFIX}900101004`, phone: "3017850044" },
  { name: "Ferretería Agrícola La Mojana", taxId: `${DEMO_PREFIX}900101005`, phone: "3027850055" },
];

/** Qué proveedor surte cada categoría (índice en `demoSuppliers`). */
const SUPPLIER_BY_CATEGORY: Record<string, number> = {
  "Alimentos balanceados": 0,
  "Medicina veterinaria": 1,
  "Semillas y fertilizantes": 2,
  "Aves de corral": 3,
  "Productos agroquímicos": 2,
  "Ferretería agrícola": 4,
};

export const supplierTaxIdFor = (category: string): string => demoSuppliers()[SUPPLIER_BY_CATEGORY[category] ?? 0]!.taxId;

export type DemoProduct = {
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  /** Peso relativo en las ventas y rango de unidades por línea. */
  popularity: number;
  minQty: number;
  maxQty: number;
  /** Vida útil típica en días (para las fechas de vencimiento de los lotes lejanos). */
  shelfDays: number;
};

type ProductSpec = [name: string, purchasePrice: number, salePrice: number, popularity: number, minQty: number, maxQty: number, shelfDays: number];

const CATALOG: Record<string, [code: string, items: ProductSpec[]]> = {
  "Alimentos balanceados": [
    "ALI",
    [
      ["Concentrado pollo engorde iniciación 40 kg", 96000, 112000, 10, 1, 4, 180],
      ["Concentrado pollo engorde finalización 40 kg", 94000, 110000, 10, 1, 4, 180],
      ["Concentrado ponedoras postura 40 kg", 92000, 108000, 9, 1, 4, 180],
      ["Concentrado cerdos levante 40 kg", 90000, 105000, 6, 1, 3, 180],
      ["Concentrado cerdos ceba 40 kg", 89000, 104000, 5, 1, 3, 180],
      ["Concentrado ganado lechero 40 kg", 98000, 115000, 6, 1, 3, 180],
      ["Sal mineralizada 8 % 40 kg", 82000, 96000, 5, 1, 2, 365],
      ["Melaza de caña 30 kg", 48000, 58000, 4, 1, 2, 365],
      ["Maíz amarillo partido 40 kg", 78000, 90000, 7, 1, 4, 150],
      ["Alimento para perros adulto 30 kg", 118000, 139000, 4, 1, 2, 270],
    ],
  ],
  "Medicina veterinaria": [
    "VET",
    [
      ["Ivermectina 1 % 500 ml", 38000, 52000, 5, 1, 2, 540],
      ["Oxitetraciclina LA 100 ml", 24000, 34000, 5, 1, 2, 540],
      ["Vitamina AD3E 100 ml", 18000, 26000, 4, 1, 2, 540],
      ["Vacuna Newcastle 1000 dosis", 42000, 58000, 3, 1, 1, 180],
      ["Albendazol 10 % 1 L", 36000, 49000, 4, 1, 2, 540],
      ["Antidiarreico para aves 100 g", 9000, 14000, 4, 1, 3, 365],
      ["Cipermetrina pour-on 1 L", 54000, 72000, 3, 1, 1, 540],
      ["Hierro dextrano 100 ml", 21000, 30000, 2, 1, 2, 540],
      ["Jeringas desechables 10 ml x 100", 28000, 39000, 3, 1, 2, 1095],
      ["Electrolitos para aves 1 kg", 16000, 23000, 4, 1, 3, 365],
    ],
  ],
  "Semillas y fertilizantes": [
    "SEM",
    [
      ["Semilla de maíz híbrido 20 kg", 420000, 495000, 2, 1, 1, 365],
      ["Semilla de arroz certificada 25 kg", 210000, 248000, 2, 1, 2, 365],
      ["Semilla pasto brachiaria 1 kg", 62000, 78000, 4, 1, 3, 365],
      ["Semilla de ahuyama 100 g", 14000, 20000, 3, 1, 3, 365],
      ["Urea 46 % 50 kg", 125000, 142000, 6, 1, 4, 730],
      ["Triple 15 (15-15-15) 50 kg", 138000, 156000, 5, 1, 3, 730],
      ["DAP 18-46-0 50 kg", 165000, 186000, 3, 1, 2, 730],
      ["Abono orgánico compostado 40 kg", 28000, 38000, 5, 1, 5, 365],
      ["Cloruro de potasio 60 % 50 kg", 142000, 160000, 2, 1, 2, 730],
    ],
  ],
  "Aves de corral": [
    "AVE",
    [
      ["Pollito de engorde de 1 día", 2900, 3800, 8, 10, 50, 7],
      ["Pollita ponedora de 1 día", 4200, 5500, 5, 10, 30, 7],
      ["Gallina ponedora de 16 semanas", 28000, 36000, 3, 2, 8, 30],
      ["Pavo bebé de 1 día", 9500, 13000, 1, 5, 15, 7],
      ["Bebedero automático 5 L", 19000, 27000, 3, 1, 3, 1095],
      ["Comedero tolva 10 kg", 23000, 32000, 3, 1, 3, 1095],
      ["Criadora a gas para pollitos", 165000, 215000, 1, 1, 1, 1095],
      ["Huevo fértil criollo x 30", 36000, 48000, 2, 1, 2, 10],
    ],
  ],
  "Productos agroquímicos": [
    "AGQ",
    [
      ["Glifosato 480 SL 1 L", 26000, 35000, 6, 1, 3, 730],
      ["Glufosinato de amonio 1 L", 48000, 62000, 2, 1, 2, 730],
      ["Insecticida lambdacihalotrina 250 ml", 22000, 31000, 4, 1, 2, 730],
      ["Fungicida mancozeb 1 kg", 24000, 33000, 4, 1, 2, 730],
      ["Herbicida 2,4-D amina 1 L", 23000, 32000, 4, 1, 2, 730],
      ["Adherente agrícola 1 L", 15000, 22000, 3, 1, 2, 730],
      ["Atrazina 90 WG 500 g", 29000, 39000, 2, 1, 2, 730],
      ["Cebo para hormiga arriera 1 kg", 19000, 27000, 3, 1, 2, 365],
    ],
  ],
  "Ferretería agrícola": [
    "FER",
    [
      ["Alambre de púas 500 m", 185000, 215000, 3, 1, 2, 1825],
      ["Grapas galvanizadas 1 kg", 9500, 13500, 4, 1, 3, 1825],
      ["Machete 22 pulgadas", 24000, 33000, 4, 1, 2, 1825],
      ["Lima triangular 8 pulgadas", 8500, 12500, 3, 1, 2, 1825],
      ["Bomba de espalda 20 L", 145000, 185000, 2, 1, 1, 1825],
      ["Manguera 1/2 pulgada x 100 m", 118000, 145000, 1, 1, 1, 1825],
      ["Pala cuadrada con cabo", 32000, 44000, 2, 1, 2, 1825],
      ["Carretilla 65 L", 165000, 205000, 1, 1, 1, 1825],
      ["Cerca eléctrica 20 km", 420000, 510000, 1, 1, 1, 1825],
      ["Balde plástico 12 L", 7500, 11000, 4, 1, 4, 1825],
      ["Lazo de nailon 10 m", 6500, 9500, 3, 1, 3, 1825],
    ],
  ],
};

/** 56 productos de una agropecuaria, con SKU `DEMO-XXX-NNN` único y precio de venta mayor que el de compra. */
export const demoProducts = (): DemoProduct[] => {
  const out: DemoProduct[] = [];
  for (const [category, [code, items]] of Object.entries(CATALOG)) {
    items.forEach(([name, purchasePrice, salePrice, popularity, minQty, maxQty, shelfDays], i) => {
      out.push({ sku: `${DEMO_PREFIX}${code}-${String(i + 1).padStart(3, "0")}`, name, category, purchasePrice, salePrice, popularity, minQty, maxQty, shelfDays });
    });
  }
  return out;
};

/* ---------- clientes ---------- */

/**
 * Perfil de cartera que el plan de ventas respeta:
 *   cash    → sin cupo, solo compra de contado;
 *   good    → compra a crédito y abona antes de los 30 días (queda al día);
 *   overdue → compró a crédito hace más de 35 días y no ha abonado (cartera vencida);
 *   maxed   → cupo pequeño que llena con pocas compras (cupo agotado).
 */
export type CustomerProfile = "cash" | "good" | "overdue" | "maxed";

export type DemoCustomer = { name: string; documentId: string; phone: string; creditLimit: number; profile: CustomerProfile };

type CustomerSpec = [name: string, creditLimit: number, profile: CustomerProfile];

const CUSTOMERS: CustomerSpec[] = [
  ["Finca La Esperanza - Luis Hernández", 2500000, "good"],
  ["Granja Avícola El Porvenir", 3000000, "good"],
  ["Hacienda San Rafael", 2000000, "good"],
  ["Porcícola Los Almendros", 1500000, "good"],
  ["Ana María Pacheco", 800000, "good"],
  ["Jorge Luis Martínez", 600000, "good"],
  ["Finca El Guayabo - Rosa Vergara", 1200000, "good"],
  ["Lechería Villa Sandra", 1800000, "good"],
  ["Cooperativa Agrícola de Sahagún", 3000000, "good"],
  ["Pedro Nel Ortega", 500000, "good"],
  ["Finca Los Cedros - Omar Díaz", 1500000, "overdue"],
  ["Avícola Doña Elvia", 900000, "overdue"],
  ["Wilson Padilla Jiménez", 800000, "overdue"],
  ["Granja La Bendición", 1200000, "overdue"],
  ["Édgar Ricardo Montes", 700000, "overdue"],
  ["Finca Monteverde - Carlos Pineda", 400000, "maxed"],
  ["Yulieth Paola Garcés", 300000, "maxed"],
  ["Parcela El Recreo", 500000, "maxed"],
  ["Hernán Darío Sotelo", 350000, "maxed"],
  ["Marelvis Berrío", 0, "cash"],
  ["Gustavo Adolfo Lora", 0, "cash"],
  ["Finca Palmasola", 0, "cash"],
  ["Nelly Patricia Salgado", 0, "cash"],
  ["Rafael Ángel Doria", 0, "cash"],
  ["Granja Las Delicias", 0, "cash"],
  ["Yesid Alfonso Narváez", 0, "cash"],
  ["Ledys Ruiz Avilez", 0, "cash"],
  ["Finca Buenos Aires - Teresa Causil", 0, "cash"],
];

/** 28 clientes con documento `DEMO-1067…` (único) y cupo según su perfil. */
export const demoCustomers = (): DemoCustomer[] =>
  CUSTOMERS.map(([name, creditLimit, profile], i) => ({
    name,
    documentId: `${DEMO_PREFIX}1067${String(100001 + i)}`,
    phone: `31${String(40000000 + i * 7919).padStart(8, "0")}`,
    creditLimit,
    profile,
  }));

/* ---------- ventas, abonos y anulaciones ---------- */

export type SaleLinePlan = { sku: string; quantity: number };

export type SaleEvent = {
  kind: "sale";
  /** Índice estable dentro del plan (para enlazar la anulación con su venta). */
  ref: number;
  at: Date;
  username: string;
  customerDocument: string | null;
  paymentType: PaymentType;
  lines: SaleLinePlan[];
  total: number;
};
export type VoidEvent = { kind: "void"; ref: number; at: Date; username: string };
export type PaymentEvent = { kind: "payment"; at: Date; username: string; customerDocument: string; amount: number };
export type SalesPlanEvent = SaleEvent | VoidEvent | PaymentEvent;

export type SalesPlan = {
  /** Eventos en orden cronológico; se ejecutan en ese orden para que cupos y abonos cuadren. */
  events: SalesPlanEvent[];
  /** Unidades vendidas por SKU (incluye las anuladas): lo que los lotes deben cubrir. */
  demand: Map<string, number>;
  firstDay: string;
  lastDay: string;
};

/**
 * Reparte ventas de contado y a crédito en los últimos `SALES_DAYS` días hasta `anchor` (YYYY-MM-DD), con abonos y
 * unas pocas anulaciones. Simula el saldo de cada cliente para no superar su cupo ni abonar más de lo debido, así la
 * lógica real (`registerSale`, `registerPayment`, `voidSale`) acepta cada evento.
 */
export const demoSalesPlan = (anchor: string, products: DemoProduct[] = demoProducts(), customers: DemoCustomer[] = demoCustomers()): SalesPlan => {
  const rng = createRng(20261029);
  const events: SalesPlanEvent[] = [];
  const demand = new Map<string, number>();
  const balance = new Map<string, number>();
  const lastCreditDay = new Map<string, number>();
  const firstDay = addDaysIso(anchor, -(SALES_DAYS - 1));
  const sellers = ["demo.caja", "demo.caja", "demo.caja", "demo.admin"];
  const weighted = products.flatMap((p) => Array.from({ length: p.popularity }, () => p));
  const creditCustomers = customers.filter((c) => c.profile !== "cash");
  // Los de cupo pequeño compran a crédito más seguido: así llegan a agotarlo.
  const creditPool = creditCustomers.flatMap((c) => Array.from({ length: c.profile === "maxed" ? 3 : 1 }, () => c));
  let ref = 0;
  let voids = 0;

  for (let d = 0; d < SALES_DAYS; d++) {
    const day = addDaysIso(firstDay, d);
    const isSunday = new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
    let count = isSunday ? (rng() < 0.4 ? 1 : 0) : 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.25 ? 1 : 0);
    if (d === SALES_DAYS - 1) count = 2;

    for (let k = 0; k < count; k++) {
      const chosen = new Map<string, SaleLinePlan>();
      const lineCount = between(rng, 1, 4);
      for (let i = 0; i < lineCount; i++) {
        const p = pick(rng, weighted);
        if (!chosen.has(p.sku)) chosen.set(p.sku, { sku: p.sku, quantity: between(rng, p.minQty, p.maxQty) });
      }
      const priceOf = (l: SaleLinePlan): number => round2(products.find((p) => p.sku === l.sku)!.salePrice * l.quantity);
      let lines = [...chosen.values()];
      let total = round2(lines.reduce((sum, l) => sum + priceOf(l), 0));

      let customer: DemoCustomer | null = null;
      let paymentType: PaymentType = "CASH";
      if (rng() < 0.42) {
        customer = pick(rng, rng() < 0.75 ? creditPool : customers);
        const current = balance.get(customer.documentId) ?? 0;
        const allowsCredit = customer.profile !== "cash" && (customer.profile !== "overdue" || d < SALES_DAYS - 36);
        if (allowsCredit && current + total <= customer.creditLimit) paymentType = "CREDIT";
        else if (allowsCredit && customer.profile === "maxed") {
          // Con el cupo casi lleno, el cliente compra solo lo que le cabe (una unidad de algo) y lo agota.
          const small = lines.map((l) => ({ ...l, quantity: 1 })).find((l) => current + priceOf(l) <= customer!.creditLimit);
          if (small !== undefined) {
            lines = [small];
            total = priceOf(small);
            paymentType = "CREDIT";
          }
        }
      }
      const at = atBusinessTime(day, 8 + k * 2, between(rng, 0, 59));
      const sale: SaleEvent = { kind: "sale", ref: ref++, at, username: pick(rng, sellers), customerDocument: customer?.documentId ?? null, paymentType, lines, total };
      events.push(sale);
      for (const l of lines) demand.set(l.sku, (demand.get(l.sku) ?? 0) + l.quantity);
      if (paymentType === "CREDIT" && customer !== null) {
        balance.set(customer.documentId, round2((balance.get(customer.documentId) ?? 0) + total));
        lastCreditDay.set(customer.documentId, d);
      }

      // Unas pocas ventas se anulan el mismo día (error de digitación, cliente que devolvió el pedido).
      // (Nunca la de un moroso a crédito: su deuda vencida debe quedar en pie.)
      if (voids < 7 && d < SALES_DAYS - 1 && !(paymentType === "CREDIT" && customer?.profile === "overdue") && rng() < 0.04) {
        voids++;
        events.push({ kind: "void", ref: sale.ref, at: atBusinessTime(day, 9 + k * 2, between(rng, 0, 59)), username: "demo.admin" });
        if (paymentType === "CREDIT" && customer !== null) balance.set(customer.documentId, round2((balance.get(customer.documentId) ?? 0) - total));
      }
    }

    // Abonos del día: los clientes "al día" pagan antes de los 30 días; los de cupo agotado abonan poco y rara vez.
    let slot = 0;
    for (const c of creditCustomers) {
      const current = balance.get(c.documentId) ?? 0;
      if (current <= 0 || c.profile === "overdue") continue;
      const since = d - (lastCreditDay.get(c.documentId) ?? d);
      let amount = 0;
      if (c.profile === "good" && (since >= 20 || rng() < 0.08)) amount = since >= 20 || rng() < 0.6 ? current : round2(Math.floor(current / 2 / 1000) * 1000);
      else if (c.profile === "maxed" && rng() < 0.03) amount = round2(Math.floor(current * 0.25 / 1000) * 1000);
      if (amount <= 0) continue;
      events.push({ kind: "payment", at: atBusinessTime(day, 16, slot++), username: pick(rng, sellers), customerDocument: c.documentId, amount });
      balance.set(c.documentId, round2(current - amount));
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { events, demand, firstDay, lastDay: anchor };
};

/* ---------- lotes ---------- */

export type BatchKind = "far" | "soon" | "expired";

export type DemoBatch = {
  sku: string;
  supplierTaxId: string;
  quantity: number;
  unitCost: number;
  /** Fecha final de vencimiento (puede ser pasada: el seed la ajusta después de registrar). */
  expiresAt: string;
  /** Cuántos días antes de `anchor` entró el lote a bodega. */
  createdDaysAgo: number;
  kind: BatchKind;
};

/**
 * Lotes por producto: los lejanos cubren con holgura la demanda del plan de ventas y entran antes de la primera venta;
 * además hay lotes pequeños que vencen en 3, 10 y 25 días y lotes ya vencidos (para las alertas y el FEFO).
 */
export const demoBatchPlan = (anchor: string, products: DemoProduct[], demand: Map<string, number>): DemoBatch[] => {
  const rng = createRng(7);
  const out: DemoBatch[] = [];
  for (const p of products) {
    const needed = (demand.get(p.sku) ?? 0) + between(rng, 8, 30);
    const supplierTaxId = supplierTaxIdFor(p.category);
    const lots = needed > 40 && rng() < 0.6 ? 2 : 1;
    const first = lots === 2 ? Math.ceil(needed * 0.6) : needed;
    const specs = lots === 2 ? [first, needed - first] : [needed];
    specs.forEach((quantity, i) => {
      // Para las aves (vida corta) el lote lejano vence en pocos días pero después de hoy; el resto según su vida útil.
      const days = p.shelfDays <= 30 ? between(rng, 40, 60) : between(rng, Math.min(150, p.shelfDays - 30), p.shelfDays);
      out.push({ sku: p.sku, supplierTaxId, quantity, unitCost: p.purchasePrice, expiresAt: addDaysIso(anchor, days), createdDaysAgo: SALES_DAYS + 10 + i * 15, kind: "far" });
    });
  }
  const perishable = products.filter((p) => p.shelfDays <= 365 && p.minQty === 1);
  const soonDays = [3, 3, 3, 10, 10, 10, 25, 25, 25];
  soonDays.forEach((days, i) => {
    const p = perishable[(i * 3) % perishable.length]!;
    out.push({ sku: p.sku, supplierTaxId: supplierTaxIdFor(p.category), quantity: between(rng, 4, 15), unitCost: p.purchasePrice, expiresAt: addDaysIso(anchor, days), createdDaysAgo: 60 + i, kind: "soon" });
  });
  [5, 12, 20, 33, 47].forEach((daysAgo, i) => {
    const p = perishable[(i * 5 + 1) % perishable.length]!;
    out.push({ sku: p.sku, supplierTaxId: supplierTaxIdFor(p.category), quantity: between(rng, 2, 8), unitCost: p.purchasePrice, expiresAt: addDaysIso(anchor, -daysAgo), createdDaysAgo: 200 + i, kind: "expired" });
  });
  return out;
};

/* ---------- proyectos del simulador financiero ---------- */

export type DemoProject = { name: string; input: SimulatorInput };

/** El ejemplo de la ampliación del brief con 100 % y 70 % de crédito (cifras de ejemplo, no del negocio real). */
export const demoProjects = (): DemoProject[] => [
  { name: "[Demo] Ampliación del local · 100 % con crédito", input: structuredClone(SIMULATOR_DEFAULTS) },
  { name: "[Demo] Ampliación del local · 70 % con crédito", input: { ...structuredClone(SIMULATOR_DEFAULTS), financing: { ...SIMULATOR_DEFAULTS.financing, creditPct: 0.7 } } },
];

/* ---------- escenarios financieros ---------- */

export type DemoScenario = { name: string; input: ScenarioInput };

export const demoScenarios = (): DemoScenario[] => [
  {
    name: "[Demo] Ampliación del local con 70 % de crédito",
    input: { fixedInvestment: 94_500_000, creditPct: 0.7, termMonths: 48, salesIncrease: 0.2, additionalExpensesMonth: 1_000_000, creditCoversWorkingCapital: false, assumptions: { ...BASE_ASSUMPTIONS } },
  },
  {
    name: "[Demo] Ampliación del local 100 % con crédito",
    input: { fixedInvestment: 94_500_000, creditPct: 1, termMonths: 48, salesIncrease: 0.2, additionalExpensesMonth: 1_000_000, creditCoversWorkingCapital: true, assumptions: { ...BASE_ASSUMPTIONS } },
  },
  {
    name: "[Demo] Solo dotación con recursos propios",
    input: { fixedInvestment: 15_000_000, creditPct: 0, termMonths: 12, salesIncrease: 0.08, additionalExpensesMonth: 300_000, creditCoversWorkingCapital: false, assumptions: { ...BASE_ASSUMPTIONS, constructionInvestment: 0 } },
  },
];

/* ---------- chat del equipo ---------- */

export type DemoAttachmentKind = "png" | "pdf" | "csv";

export type DemoChatMessage = {
  /** Clave estable del mensaje; de ella sale el `clientId` (UUID) que evita duplicados. */
  key: string;
  from: string;
  /** Destinatario de un privado; ausente en el canal general. */
  to?: string;
  body: string;
  replyTo?: string;
  threadRoot?: string;
  attachment?: DemoAttachmentKind;
  pinned?: boolean;
  daysAgo: number;
  time: string;
};

/** Guion de 34 mensajes: canal general con un hilo, una cita y un fijado; privados; tres adjuntos reales. */
export const demoChatScript = (): DemoChatMessage[] => [
  { key: "g01", from: "demo.admin", body: "Buenos días, equipo. Esta semana llega el pedido de concentrados: revisen que haya espacio en la bodega del fondo.", daysAgo: 9, time: "07:40" },
  { key: "g02", from: "demo.bodega", body: "Listo, ya corrí los bultos de sal mineralizada para dejar el pasillo libre.", daysAgo: 9, time: "08:05" },
  { key: "g03", from: "demo.caja", body: "¿Alguien sabe si el pollito de engorde llega el jueves o el viernes? Tengo tres clientes esperando.", daysAgo: 8, time: "09:12" },
  { key: "g04", from: "demo.admin", body: "La incubadora confirmó para el viernes a primera hora.", threadRoot: "g03", daysAgo: 8, time: "09:30" },
  { key: "g05", from: "demo.caja", body: "Perfecto, les aviso a los clientes.", threadRoot: "g03", daysAgo: 8, time: "09:33" },
  { key: "g06", from: "demo.bodega", body: "Dejo las cajas de recibo preparadas desde el jueves en la tarde.", threadRoot: "g03", daysAgo: 8, time: "10:02" },
  { key: "g07", from: "demo.bodega", body: "Encontré un lote de concentrado para cerdos ya vencido, @demo.admin. Adjunto la foto de la etiqueta.", attachment: "png", daysAgo: 7, time: "11:20" },
  { key: "g08", from: "demo.admin", body: "Gracias. Sepárenlo y lo gestionamos con el proveedor; no se vende ni una bolsa de ese lote.", replyTo: "g07", daysAgo: 7, time: "11:35" },
  { key: "g09", from: "demo.admin", body: "Lista de precios vigente desde el 1 de noviembre. Por favor usarla en caja y en los pedidos telefónicos.", attachment: "pdf", pinned: true, daysAgo: 6, time: "08:00" },
  { key: "g10", from: "demo.caja", body: "Recibida. Ya la imprimí y quedó en el mostrador.", daysAgo: 6, time: "08:25" },
  { key: "g11", from: "demo.caja", body: "Hoy vendimos 4 bultos de urea y 2 de triple 15 a la cooperativa, a crédito. Quedan al límite del cupo.", daysAgo: 5, time: "17:10" },
  { key: "g12", from: "demo.admin", body: "Bien. La cooperativa paga puntual; déjalo así.", daysAgo: 5, time: "17:40" },
  { key: "g13", from: "demo.bodega", body: "Recordatorio: mañana a las 7:30 reviso los lotes que vencen esta semana (ivermectina y vacunas).", daysAgo: 4, time: "16:50" },
  { key: "g14", from: "demo.admin", body: "@todos: el sábado cerramos a las 2 p. m. por inventario general.", daysAgo: 3, time: "12:00" },
  { key: "g15", from: "demo.caja", body: "Anotado.", daysAgo: 3, time: "12:04" },
  { key: "g16", from: "demo.bodega", body: "Anotado también. Dejo los formatos de conteo listos.", daysAgo: 3, time: "12:10" },
  { key: "g17", from: "demo.caja", body: "Don Omar (Finca Los Cedros) volvió a pedir a crédito y aún debe lo de agosto. Le dije que primero abonara.", daysAgo: 2, time: "10:45" },
  { key: "g18", from: "demo.admin", body: "Correcto. Esa cartera ya está vencida; sin abono no hay más crédito.", replyTo: "g17", daysAgo: 2, time: "11:00" },
  { key: "g19", from: "demo.bodega", body: "Llegó la cerca eléctrica y las bombas de espalda. Ya quedaron en sistema con su lote.", daysAgo: 1, time: "15:30" },
  { key: "g20", from: "demo.admin", body: "Gracias a los dos por la semana. Mañana revisamos el reporte de ventas del mes.", daysAgo: 1, time: "18:20" },
  { key: "g21", from: "demo.caja", body: "Buenos días. Ya abrí caja; hay dos pedidos de pollito pendientes de entrega.", daysAgo: 0, time: "07:50" },
  { key: "g22", from: "demo.bodega", body: "Buenos días. Los pollitos están en la criadora, listos para entregar a las 9.", daysAgo: 0, time: "07:58" },
  { key: "p01", from: "demo.caja", to: "demo.bodega", body: "Jairo, ¿me confirmas cuántos bultos de concentrado ponedoras quedan? El sistema dice 23 y el cliente quiere 25.", daysAgo: 6, time: "14:10" },
  { key: "p02", from: "demo.bodega", to: "demo.caja", body: "Conté 23, igual que el sistema. Le vendemos 23 y el resto el martes que llega pedido.", daysAgo: 6, time: "14:22" },
  { key: "p03", from: "demo.caja", to: "demo.bodega", body: "Listo, gracias. Te paso el conteo de la semana pasada para que lo compares.", attachment: "csv", daysAgo: 6, time: "14:30" },
  { key: "p04", from: "demo.bodega", to: "demo.caja", body: "Recibido, lo reviso en la tarde.", daysAgo: 6, time: "14:31" },
  { key: "p05", from: "demo.bodega", to: "demo.caja", body: "Revisado: solo difiere el glifosato (hay 2 menos). Ya lo ajusté con la venta que faltaba registrar.", daysAgo: 5, time: "09:15" },
  { key: "p06", from: "demo.admin", to: "demo.caja", body: "Luisa, ¿cómo va la cartera de la Avícola Doña Elvia? Lleva más de un mes sin abonar.", daysAgo: 3, time: "15:05" },
  { key: "p07", from: "demo.caja", to: "demo.admin", body: "La llamé ayer; dijo que abona la próxima semana cuando venda los huevos.", daysAgo: 3, time: "15:20" },
  { key: "p08", from: "demo.admin", to: "demo.caja", body: "Bien. Si no abona el viernes, me avisas y la llamo yo.", daysAgo: 3, time: "15:24" },
  { key: "p09", from: "demo.caja", to: "demo.admin", body: "De acuerdo.", daysAgo: 3, time: "15:25" },
  { key: "p10", from: "demo.admin", to: "demo.bodega", body: "Jairo, antes del inventario del sábado saca del sistema los lotes vencidos que ya se devolvieron.", daysAgo: 2, time: "08:30" },
  { key: "p11", from: "demo.bodega", to: "demo.admin", body: "Claro. Quedan dos por confirmar con el proveedor; el resto ya está.", daysAgo: 2, time: "08:45" },
  { key: "p12", from: "demo.admin", to: "demo.bodega", body: "Perfecto, gracias.", daysAgo: 2, time: "08:46" },
];

/** UUID determinista (versión 4 en forma) a partir de la clave de un mensaje demo. */
export const demoClientId = (key: string): string => {
  const hex = createHash("md5").update(`mi-tierrita-seed:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/* ---------- archivos adjuntos generados ---------- */

export type DemoFile = { name: string; mime: string; data: Buffer };

/** CRC-32 (IEEE) tal como lo exige PNG para cada bloque. */
const crc32 = (buf: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * PNG válido de 64×64 (RGB, 8 bits) generado en memoria: una etiqueta verde con una franja roja diagonal, como la
 * "foto" de un lote vencido. Se comprime con zlib (parte de Node), sin dependencias.
 */
export const demoPng = (): DemoFile => {
  const size = 64;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtro "None" de la fila
    for (let x = 0; x < size; x++) {
      const i = y * (size * 3 + 1) + 1 + x * 3;
      const stripe = Math.abs(x - y) < 6;
      const border = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
      raw[i] = border ? 60 : stripe ? 200 : 56 + Math.floor((y / size) * 40);
      raw[i + 1] = border ? 90 : stripe ? 40 : 140 + Math.floor((x / size) * 60);
      raw[i + 2] = border ? 50 : stripe ? 40 : 60;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 2; // color RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const data = Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
  return { name: "foto-lote-vencido.png", mime: "image/png", data };
};

/** PDF 1.4 mínimo y válido (una página carta, Helvetica) con la lista de precios de ejemplo. Sin tildes: fuente estándar. */
export const demoPdf = (): DemoFile => {
  const lines = [
    "Mi Tierrita - Lista de precios (vigente desde el 1 de noviembre de 2026)",
    "",
    ...demoProducts()
      .slice(0, 24)
      .map((p) => `${p.sku}  ${p.name.normalize("NFD").replace(/[̀-ͯ]/g, "")}  $${p.salePrice.toLocaleString("en-US")}`),
    "",
    "Documento de ejemplo generado por el seed de datos demo.",
  ];
  const escape = (s: string): string => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...lines.map((l) => `(${escape(l)}) Tj T*`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: "lista-precios-noviembre.pdf", mime: "application/pdf", data: Buffer.from(pdf, "latin1") };
};

/** CSV con un conteo de bodega de ejemplo (UTF-8 con BOM para que Excel lea las tildes). */
export const demoCsv = (): DemoFile => {
  const rows = demoProducts()
    .slice(0, 20)
    .map((p, i) => `${p.sku};${p.name};${10 + ((i * 7) % 25)}`);
  const text = `﻿SKU;Producto;Unidades contadas\n${rows.join("\n")}\n`;
  return { name: "conteo-bodega.csv", mime: "text/csv", data: Buffer.from(text, "utf8") };
};

export const demoFile = (kind: DemoAttachmentKind): DemoFile => (kind === "png" ? demoPng() : kind === "pdf" ? demoPdf() : demoCsv());

/* ---------- contacto del sitio y exportaciones ---------- */

export type DemoContactMessage = { name: string; phone: string | null; email: string; topic: string | null; body: string };

export const demoContactMessages = (): DemoContactMessage[] => [
  { name: "Carmen Julia Ramos", phone: "3134455667", email: "carmen.ramos@ejemplo.demo", topic: "Pedido", body: "Buenas tardes, quisiera saber si tienen pollita ponedora de un día para la próxima semana y a qué precio. Necesito unas 60." },
  { name: "Andrés Felipe Causil", phone: null, email: "afcausil@ejemplo.demo", topic: "Crédito", body: "¿Manejan crédito para fincas? Tengo una granja porcícola en la vereda El Viajano y me interesa abrir cupo." },
  { name: "Distribuidora Nutrianimal", phone: "6047801122", email: "ventas@nutrianimal.ejemplo.demo", topic: "Proveedores", body: "Somos distribuidores de concentrados y quisiéramos presentarles nuestro portafolio. ¿Con quién podemos hablar?" },
];

export type DemoReportExport = { username: string; role: Role; report: ExportReport; format: ExportFormat; description: string; filters: ExportData; summary: ExportData };

export const demoReportExports = (anchor: string): DemoReportExport[] => {
  const monthStart = `${anchor.slice(0, 8)}01`;
  return [
    { username: "demo.admin", role: "ADMIN", report: "sales", format: "pdf", description: `Ventas del ${monthStart} al ${anchor}`, filters: { from: monthStart, to: anchor, groupBy: "day" }, summary: { note: "Reporte de ejemplo" } },
    { username: "demo.admin", role: "ADMIN", report: "inventory", format: "xlsx", description: `Inventario valorizado al ${anchor}`, filters: { asOf: anchor }, summary: { note: "Reporte de ejemplo" } },
    { username: "demo.admin", role: "ADMIN", report: "receivables", format: "pdf", description: `Cartera vencida al ${anchor}`, filters: { overdueDays: 30 }, summary: { note: "Reporte de ejemplo" } },
    { username: "demo.admin", role: "ADMIN", report: "scenario", format: "pdf", description: "Escenario [Demo] Ampliación del local con 70 % de crédito", filters: {}, summary: { note: "Reporte de ejemplo" } },
    { username: "demo.caja", role: "SALES", report: "sales", format: "xlsx", description: `Ventas de la semana al ${anchor}`, filters: { from: addDaysIso(anchor, -6), to: anchor, groupBy: "day" }, summary: { note: "Reporte de ejemplo" } },
  ];
};

/* ---------- Pedidos, nómina y conteos de inventario (fechas alrededor del día en que se corre el seed) ---------- */

/** Pedido demo: la nota es la clave natural (idempotencia). Los productos, proveedores y clientes se toman de los demo. */
export type DemoOrder = { note: string; kind: "SUPPLIER" | "CUSTOMER"; dueInDays: number; lines: { productIndex: number; quantity: number }[]; counterpartIndex: number };

export const demoOrders = (): DemoOrder[] => [
  { note: "[Demo] Reposición de concentrados de la semana", kind: "SUPPLIER", dueInDays: 1, counterpartIndex: 0, lines: [{ productIndex: 0, quantity: 20 }, { productIndex: 1, quantity: 12 }] },
  { note: "[Demo] Pedido de semillas para la siembra", kind: "SUPPLIER", dueInDays: 6, counterpartIndex: 2, lines: [{ productIndex: 20, quantity: 15 }] },
  { note: "[Demo] Encargo de pollito de engorde para la finca", kind: "CUSTOMER", dueInDays: 2, counterpartIndex: 1, lines: [{ productIndex: 30, quantity: 50 }] },
  { note: "[Demo] Encargo de vitaminas y comederos", kind: "CUSTOMER", dueInDays: 9, counterpartIndex: 3, lines: [{ productIndex: 10, quantity: 4 }, { productIndex: 50, quantity: 2 }] },
];

/** Empleados demo de nómina (salarios de ejemplo, no valores legales). `username` vincula la cuenta demo si existe. */
export type DemoEmployee = { documentId: string; firstName: string; lastName: string; position: string; baseSalary: number; payFrequency: "MONTHLY" | "BIWEEKLY"; username: string | null };

export const demoEmployees = (): DemoEmployee[] => [
  { documentId: "DEMO-NOM-01", firstName: "Luis Fernando", lastName: "Ortega", position: "Auxiliar de bodega", baseSalary: 1_800_000, payFrequency: "BIWEEKLY", username: null },
  { documentId: "DEMO-NOM-02", firstName: "Luisa", lastName: "Demo", position: "Secretaria de caja", baseSalary: 1_900_000, payFrequency: "BIWEEKLY", username: "demo.caja" },
  { documentId: "DEMO-NOM-03", firstName: "Jairo", lastName: "Demo", position: "Encargado de bodega", baseSalary: 1_950_000, payFrequency: "BIWEEKLY", username: "demo.bodega" },
];

/** Quincena en curso para un día dado: del 1 al 15 o del 16 a fin de mes; se paga el último día del periodo. */
export const currentFortnight = (today: string): { periodStart: string; periodEnd: string; payDate: string } => {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const month = `${y}-${String(m).padStart(2, "0")}`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= 15 ? { periodStart: `${month}-01`, periodEnd: `${month}-15`, payDate: `${month}-15` } : { periodStart: `${month}-16`, periodEnd: `${month}-${lastDay}`, payDate: `${month}-${lastDay}` };
};

/** Conteos demo: el título es la clave natural. `categoryName` null = todo el inventario. */
export type DemoCount = { title: string; inDays: number; categoryName: string | null };

export const demoCounts = (): DemoCount[] => [
  { title: "[Demo] Conteo de medicina veterinaria", inDays: 2, categoryName: "Medicina veterinaria" },
  { title: "[Demo] Conteo general de bodega", inDays: 7, categoryName: null },
];
