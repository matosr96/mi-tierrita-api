import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_PREFIX,
  PNG_SIGNATURE,
  SALES_DAYS,
  demoBatchPlan,
  demoCategories,
  demoChatScript,
  demoClientId,
  demoCsv,
  demoCustomers,
  demoPdf,
  demoPng,
  demoProducts,
  demoSalesPlan,
  demoUsers,
} from "../src/scripts/seed-data";

/** Brief de octubre de 2026, punto 39: las funciones puras del seed (sin base de datos). */

const ANCHOR = "2026-10-29";

test("demoUsers trae un usuario demo por rol", () => {
  const users = demoUsers();
  assert.deepEqual(users.map((u) => u.role).sort(), ["ADMIN", "SALES", "WAREHOUSE"]);
  assert.ok(users.every((u) => u.username.startsWith("demo.")));
});

test("demoProducts: entre 40 y 60 productos con SKU DEMO- único, categoría conocida y precio de venta mayor que el de compra", () => {
  const products = demoProducts();
  const categories = new Set(demoCategories());
  assert.ok(products.length >= 40 && products.length <= 60, `hay ${products.length}`);
  assert.equal(new Set(products.map((p) => p.sku.toLowerCase())).size, products.length);
  for (const p of products) {
    assert.ok(p.sku.startsWith(DEMO_PREFIX), p.sku);
    assert.ok(categories.has(p.category), `${p.sku} en categoría ${p.category}`);
    assert.ok(p.salePrice > p.purchasePrice && p.purchasePrice > 0, p.sku);
    assert.ok(p.minQty >= 1 && p.maxQty >= p.minQty, p.sku);
  }
  assert.equal(categories.size, 6);
});

test("demoCustomers: entre 25 y 30 clientes con documento DEMO- único y cupo acorde a su perfil", () => {
  const customers = demoCustomers();
  assert.ok(customers.length >= 25 && customers.length <= 30, `hay ${customers.length}`);
  assert.equal(new Set(customers.map((c) => c.documentId)).size, customers.length);
  for (const c of customers) {
    assert.ok(c.documentId.startsWith(DEMO_PREFIX));
    assert.equal(c.creditLimit === 0, c.profile === "cash", c.name);
  }
  for (const profile of ["good", "overdue", "maxed"] as const) assert.ok(customers.some((c) => c.profile === profile), profile);
});

test("demoSalesPlan reparte 150–250 ventas en los últimos 120 días, respeta cupos y abonos y es determinista", () => {
  const products = demoProducts();
  const customers = demoCustomers();
  const plan = demoSalesPlan(ANCHOR, products, customers);
  const sales = plan.events.filter((e) => e.kind === "sale");
  assert.ok(sales.length >= 150 && sales.length <= 250, `hay ${sales.length} ventas`);
  assert.equal(plan.lastDay, ANCHOR);
  const first = new Date(`${plan.firstDay}T00:00:00-05:00`).getTime();
  const last = new Date(`${ANCHOR}T23:59:59-05:00`).getTime();
  assert.equal((last - first) / 86_400_000 > SALES_DAYS - 1, true);

  // Orden cronológico, instantes únicos por vendedor y fechas dentro del rango
  const keys = new Set<string>();
  let previous = 0;
  for (const e of plan.events) {
    assert.ok(e.at.getTime() >= previous, "los eventos van en orden");
    assert.ok(e.at.getTime() >= first && e.at.getTime() <= last, `fuera de rango: ${e.at.toISOString()}`);
    previous = e.at.getTime();
    if (e.kind === "sale") {
      const key = `${e.username}@${e.at.getTime()}`;
      assert.ok(!keys.has(key), `instante repetido ${key}`);
      keys.add(key);
    }
  }

  // Simulación de cartera: ninguna venta supera el cupo, ningún abono supera el saldo
  const limit = new Map(customers.map((c) => [c.documentId, c.creditLimit]));
  const balance = new Map<string, number>();
  const totals = new Map<number, { doc: string | null; type: string; total: number }>();
  let credit = 0;
  let voided = 0;
  let payments = 0;
  for (const e of plan.events) {
    if (e.kind === "sale") {
      assert.ok(e.lines.length >= 1 && e.lines.length <= 4);
      const expected = Math.round(e.lines.reduce((s, l) => s + products.find((p) => p.sku === l.sku)!.salePrice * l.quantity, 0) * 100) / 100;
      assert.equal(e.total, expected);
      totals.set(e.ref, { doc: e.customerDocument, type: e.paymentType, total: e.total });
      if (e.paymentType === "CREDIT") {
        credit++;
        assert.ok(e.customerDocument !== null, "crédito sin cliente");
        const next = (balance.get(e.customerDocument) ?? 0) + e.total;
        assert.ok(next <= (limit.get(e.customerDocument) ?? 0) + 0.001, `cupo superado para ${e.customerDocument}`);
        balance.set(e.customerDocument, next);
      }
    } else if (e.kind === "void") {
      voided++;
      const s = totals.get(e.ref)!;
      assert.ok(s !== undefined, "anulación de una venta inexistente");
      if (s.type === "CREDIT" && s.doc !== null) balance.set(s.doc, (balance.get(s.doc) ?? 0) - s.total);
    } else {
      payments++;
      const current = balance.get(e.customerDocument) ?? 0;
      assert.ok(e.amount > 0 && e.amount <= current + 0.001, `abono mayor que el saldo de ${e.customerDocument}`);
      balance.set(e.customerDocument, current - e.amount);
    }
  }
  assert.ok(credit >= 30, `solo ${credit} ventas a crédito`);
  assert.ok(voided >= 3 && voided <= 7, `${voided} anulaciones`);
  assert.ok(payments >= 20, `solo ${payments} abonos`);
  // Perfiles: los morosos quedan con saldo; alguno de cupo pequeño lo tiene agotado
  const byDoc = new Map(customers.map((c) => [c.documentId, c]));
  for (const [doc, b] of balance) {
    if (byDoc.get(doc)!.profile === "overdue") assert.ok(b > 0, `${doc} debería deber`);
  }
  assert.ok(customers.some((c) => c.profile === "maxed" && (balance.get(c.documentId) ?? 0) >= c.creditLimit * 0.7), "ningún cliente con cupo agotado");

  const again = demoSalesPlan(ANCHOR, products, customers);
  assert.deepEqual(again.events, plan.events);
});

test("demoBatchPlan cubre la demanda con lotes lejanos y agrega lotes por vencer en 3, 10 y 25 días y vencidos", () => {
  const products = demoProducts();
  const plan = demoSalesPlan(ANCHOR, products, demoCustomers());
  const batches = demoBatchPlan(ANCHOR, products, plan.demand);
  const skus = new Set(products.map((p) => p.sku));
  for (const [sku, qty] of plan.demand) {
    const far = batches.filter((b) => b.sku === sku && b.kind === "far").reduce((s, b) => s + b.quantity, 0);
    assert.ok(far >= qty, `${sku}: lotes ${far} < demanda ${qty}`);
  }
  for (const b of batches) {
    assert.ok(skus.has(b.sku));
    assert.ok(b.quantity > 0 && b.unitCost > 0);
    if (b.kind === "far") assert.ok(b.expiresAt > ANCHOR && b.createdDaysAgo >= SALES_DAYS);
    if (b.kind === "expired") assert.ok(b.expiresAt < ANCHOR);
  }
  for (const date of ["2026-11-01", "2026-11-08", "2026-11-23"]) assert.ok(batches.some((b) => b.kind === "soon" && b.expiresAt === date), date);
  assert.ok(batches.filter((b) => b.kind === "expired").length >= 3);
});

test("los adjuntos generados empiezan con la firma de su formato", () => {
  const png = demoPng();
  assert.equal(png.mime, "image/png");
  assert.ok(png.data.subarray(0, 8).equals(PNG_SIGNATURE));
  assert.equal(png.data.subarray(12, 16).toString("latin1"), "IHDR");
  assert.equal(png.data.readUInt32BE(16), 64);
  assert.equal(png.data.subarray(png.data.length - 8, png.data.length - 4).toString("latin1"), "IEND");

  const pdf = demoPdf();
  assert.equal(pdf.mime, "application/pdf");
  const text = pdf.data.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4\n"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  // Cada entrada de la tabla xref apunta exactamente a "N 0 obj"
  const xrefAt = Number(/startxref\n(\d+)\n/.exec(text)![1]);
  assert.equal(text.slice(xrefAt, xrefAt + 4), "xref");
  const entries = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
  assert.equal(entries.length, 5);
  entries.forEach((offset, i) => assert.equal(text.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));

  const csv = demoCsv();
  assert.equal(csv.mime, "text/csv");
  assert.ok(csv.data.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
  assert.ok(csv.data.toString("utf8").includes("SKU;Producto;Unidades contadas"));
});

test("demoClientId da un UUID estable y distinto por mensaje; el guion del chat tiene hilo, cita, fijado, privados y adjuntos", () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(demoClientId("g01"), uuid);
  assert.equal(demoClientId("g01"), demoClientId("g01"));
  assert.notEqual(demoClientId("g01"), demoClientId("g02"));

  const script = demoChatScript();
  const usernames = new Set(demoUsers().map((u) => u.username));
  assert.ok(script.length >= 20 && script.length <= 40, `hay ${script.length} mensajes`);
  assert.equal(new Set(script.map((m) => m.key)).size, script.length);
  const seen = new Set<string>();
  for (const m of script) {
    assert.ok(usernames.has(m.from) && (m.to === undefined || usernames.has(m.to)), m.key);
    assert.notEqual(m.from, m.to, m.key);
    if (m.replyTo !== undefined) assert.ok(seen.has(m.replyTo), `${m.key} cita un mensaje posterior`);
    if (m.threadRoot !== undefined) assert.ok(seen.has(m.threadRoot), `${m.key} responde a un hilo posterior`);
    assert.match(m.time, /^\d{2}:\d{2}$/);
    seen.add(m.key);
  }
  assert.ok(script.some((m) => m.threadRoot !== undefined));
  assert.ok(script.some((m) => m.replyTo !== undefined));
  assert.equal(script.filter((m) => m.pinned === true).length, 1);
  assert.ok(script.some((m) => m.to !== undefined));
  assert.deepEqual(script.filter((m) => m.attachment !== undefined).map((m) => m.attachment), ["png", "pdf", "csv"]);
});

import { currentFortnight, demoCounts, demoEmployees, demoOrders } from "../src/scripts/seed-data";

test("seed: pedidos, empleados y conteos demo con claves únicas y la quincena en curso bien calculada", () => {
  const notes = demoOrders().map((o) => o.note);
  assert.equal(new Set(notes).size, notes.length);
  assert.ok(demoOrders().some((o) => o.kind === "SUPPLIER") && demoOrders().some((o) => o.kind === "CUSTOMER"));
  const docs = demoEmployees().map((e) => e.documentId);
  assert.equal(new Set(docs).size, docs.length);
  assert.ok(demoEmployees().every((e) => e.baseSalary > 0));
  assert.equal(new Set(demoCounts().map((c) => c.title)).size, demoCounts().length);
  assert.ok(demoCounts().every((c) => c.inDays >= 0));
  assert.deepEqual(currentFortnight("2026-10-29"), { periodStart: "2026-10-16", periodEnd: "2026-10-31", payDate: "2026-10-31" });
  assert.deepEqual(currentFortnight("2026-02-03"), { periodStart: "2026-02-01", periodEnd: "2026-02-15", payDate: "2026-02-15" });
  assert.deepEqual(currentFortnight("2026-02-20"), { periodStart: "2026-02-16", periodEnd: "2026-02-28", payDate: "2026-02-28" });
});
