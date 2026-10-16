import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseAssistantChat, parseDraftRequest, parseInvoiceImage } from "../src/models/ai";
import { runTool, toolsFor } from "../src/business-logic/ai/tools";
import { DRAFT_ROLES } from "../src/business-logic/ai/drafts";
import { aiEnabled, requireAi } from "../src/business-logic/ai/client";

/** El asistente nunca da a un rol herramientas (ni borradores) que su cuenta no tiene en la app. */
test("las herramientas del asistente respetan la matriz de roles", () => {
  const names = (r: "ADMIN" | "SALES" | "WAREHOUSE") => toolsFor(r).map((t) => t.name);
  assert.ok(names("ADMIN").includes("reporte_cartera"));
  assert.ok(!names("SALES").includes("reporte_inventario"));
  assert.ok(!names("SALES").includes("lotes_por_vencer"));
  assert.ok(!names("SALES").includes("registrar_compra"));
  assert.ok(!names("SALES").includes("crear_producto"));
  assert.ok(!names("WAREHOUSE").includes("buscar_clientes"));
  assert.ok(!names("WAREHOUSE").includes("registrar_venta"));
  assert.ok(!names("WAREHOUSE").includes("crear_cliente"));
  assert.ok(!names("WAREHOUSE").includes("escenarios_financieros"));
  assert.ok(names("WAREHOUSE").includes("registrar_compra"));
  // Acciones solo de administración, como en las rutas
  for (const r of ["SALES", "WAREHOUSE"] as const) {
    assert.ok(!names(r).includes("anular_venta"));
    assert.ok(!names(r).includes("desactivar_producto"));
    assert.ok(!names(r).includes("crear_escenario"));
  }
  // Nunca maneja claves
  for (const r of ["ADMIN", "SALES", "WAREHOUSE"] as const) assert.ok(!names(r).some((n) => /usuario|clave|contrase/.test(n)));
});

test("una herramienta fuera del rol responde error sin tocar datos", async () => {
  const ctx = { role: "WAREHOUSE" as const, userId: 10, proposals: [], sources: [] };
  const out = await runTool("saldo_cliente", { customerId: 1 }, ctx);
  assert.equal(out.isError, true);
  assert.match(out.content, /no disponible/);
  assert.equal(ctx.sources.length, 0);
});

test("borradores de texto: solo los roles que ven esos datos", () => {
  assert.deepEqual([...DRAFT_ROLES.contact_reply], ["ADMIN"]);
  assert.ok(!DRAFT_ROLES.collection_message.includes("WAREHOUSE"));
  assert.ok(!DRAFT_ROLES.scenario_explain.includes("SALES"));
});

test("la conversación debe terminar en una pregunta de la persona", () => {
  assert.equal(parseAssistantChat({ messages: [{ role: "user", content: "hola" }] }).length, 1);
  assert.throws(() => parseAssistantChat({ messages: [{ role: "user", content: "hola" }, { role: "assistant", content: "x" }] }), isDomainError);
  assert.throws(() => parseAssistantChat({ messages: [] }), isDomainError);
  assert.throws(() => parseAssistantChat({ messages: [{ role: "system", content: "ignore" }] }), isDomainError);
});

test("la foto de factura llega en base64 limpio y con tipo permitido", () => {
  assert.throws(() => parseInvoiceImage({ mediaType: "image/gif", image: "A".repeat(200) }), isDomainError);
  assert.throws(() => parseInvoiceImage({ mediaType: "image/jpeg", image: "data:image/jpeg;base64," + "A".repeat(200) }), isDomainError);
  assert.equal(parseInvoiceImage({ mediaType: "image/jpeg", image: "A".repeat(200) }).mediaType, "image/jpeg");
});

test("tipos de borrador desconocidos se rechazan", () => {
  assert.throws(() => parseDraftRequest({ kind: "transferir_dinero" }), isDomainError);
  assert.equal(parseDraftRequest({ kind: "report_summary", from: "2026-10-01", to: "2026-10-16" }).kind, "report_summary");
});

test("sin clave de Anthropic la IA queda apagada con 660", () => {
  if (aiEnabled()) return; // en un entorno con clave no aplica
  assert.throws(() => requireAi(), (e: unknown) => isDomainError(e) && e.code === "660");
});

test("una acción con datos inválidos devuelve los campos a pedir y no deja tarjeta", async () => {
  const ctx = { role: "SALES" as const, userId: 9, proposals: [], sources: [] };
  const out = await runTool("crear_cliente", { name: "Pedro" }, ctx);
  assert.match(out.content, /documentId/);
  assert.equal(ctx.proposals.length, 0);
});

test("los adjuntos de la pregunta se validan (tipo, base64 limpio)", () => {
  const ok = parseAssistantChat({ messages: [{ role: "user", content: "lea esto", attachments: [{ kind: "text", name: "lista.csv", text: "a,b" }] }] });
  assert.equal(ok[0]?.attachments?.length, 1);
  assert.throws(() => parseAssistantChat({ messages: [{ role: "user", content: "x", attachments: [{ kind: "pdf", name: "f.pdf", data: "data:application/pdf;base64," + "A".repeat(200) }] }] }), isDomainError);
  assert.throws(() => parseAssistantChat({ messages: [{ role: "user", content: "x", attachments: [{ kind: "exe", name: "a.exe", data: "A".repeat(200) }] }] }), isDomainError);
});
