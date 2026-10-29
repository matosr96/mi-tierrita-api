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

/* ---------- Brief de octubre de 2026: respuesta en dos pasos e historial ---------- */
import { parseAssistantChatRequest, parseConversationEvent } from "../src/models/ai";
import { clearAssistantTasks, getAssistantTask, MAX_PENDING_PER_USER, startAssistantTask } from "../src/business-logic/ai/tasks";
import { conversationTitle } from "../src/business-logic/ai/conversations";
import { colombiaNow, systemPrompt } from "../src/business-logic/ai/assistant";

const issues400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};
const tick = () => new Promise((r) => setTimeout(r, 5));

test("POST /ai/chat: asincrono es opcional (false por defecto) y acepta conversación y pantalla", () => {
  const plain = parseAssistantChatRequest({ messages: [{ role: "user", content: "Hola" }] });
  assert.equal(plain.asincrono, false);
  assert.equal(plain.conversationId, undefined);
  const full = parseAssistantChatRequest({ messages: [{ role: "user", content: "Hola" }], asincrono: true, conversationId: 7, screen: "inventario" });
  assert.equal(full.asincrono, true);
  assert.equal(full.conversationId, 7);
  assert.equal(full.screen, "inventario");
  assert.deepEqual(issues400(() => parseAssistantChatRequest({ messages: [{ role: "user", content: "Hola" }], asincrono: "sí", screen: "otra" })), ["asincrono", "screen"]);
});

test("GET /ai/mensajes/:tareaId: la tarea pasa de pendiente a lista y solo la ve su dueño", async () => {
  clearAssistantTasks();
  const id = startAssistantTask(1, async () => {
    await tick();
    return { reply: "Listo" };
  });
  assert.equal(getAssistantTask(1, id).state, "pending");
  assert.throws(() => getAssistantTask(2, id), (err: unknown) => isDomainError(err) && err.code === "662");
  await tick();
  await tick();
  const done = getAssistantTask<{ reply: string }>(1, id);
  assert.equal(done.state, "done");
  if (done.state === "done") assert.equal(done.result.reply, "Listo");
  assert.throws(() => getAssistantTask(1, "no-existe"), (err: unknown) => isDomainError(err) && err.code === "662");
});

test("GET /ai/mensajes/:tareaId: un fallo del proveedor se guarda con su código y el tope de tareas en curso responde 640", async () => {
  clearAssistantTasks();
  const id = startAssistantTask(3, async () => {
    throw new (await import("../src/common/errors")).DomainError("661");
  });
  await tick();
  const failed = getAssistantTask(3, id);
  assert.equal(failed.state, "failed");
  if (failed.state === "failed") assert.equal(failed.code, "661");
  const never = () => new Promise<never>(() => undefined);
  for (let i = 0; i < MAX_PENDING_PER_USER; i++) startAssistantTask(4, never);
  assert.throws(() => startAssistantTask(4, never), (err: unknown) => isDomainError(err) && err.code === "640");
  clearAssistantTasks();
});

test("POST /ai/conversations/:id/events: messageId e index van juntos y el estado exige tarjeta", () => {
  assert.equal(parseConversationEvent({ content: "Descartado: crear cliente." }).messageId, undefined);
  const ok = parseConversationEvent({ content: "Confirmado", messageId: 9, index: 0, status: "done", note: "id 4" });
  assert.equal(ok.status, "done");
  assert.deepEqual(issues400(() => parseConversationEvent({ content: "x", messageId: 9 })), ["messageId"]);
  assert.deepEqual(issues400(() => parseConversationEvent({ content: "x", status: "done" })), ["status"]);
  assert.deepEqual(issues400(() => parseConversationEvent({ content: "" })), ["content"]);
});

test("el título del historial sale de la primera pregunta, en una línea y corto", () => {
  assert.equal(conversationTitle("  ¿Qué\n lotes   vencen? "), "¿Qué lotes vencen?");
  assert.equal(conversationTitle("a".repeat(100)).length, 80);
  assert.equal(conversationTitle("   "), "Conversación");
});

test("el prompt lleva fecha y hora de Colombia y la pantalla desde la que se pregunta", () => {
  assert.match(colombiaNow(new Date("2026-10-29T20:05:00Z")), /^jueves, 29 de octubre de 2026, 03:05 p\.\s?m\.$/);
  const p = systemPrompt("WAREHOUSE", "Alexa", "lotes");
  assert.match(p, /Ahora mismo es .*hora de Colombia/);
  assert.match(p, /Lotes y vencimientos/);
  assert.doesNotMatch(systemPrompt("ADMIN", "Ana"), /le habla desde la pantalla/);
});

import { joinCompletion, MIN_PREFIX } from "../src/business-logic/ai/complete";
import { parseCompleteRequest } from "../src/models/ai";

test("POST /ai/complete: la continuación se une al texto sin repetirlo y con el espacio correcto", () => {
  assert.equal(joinCompletion("¿Qué lotes", "vencen esta semana?"), " vencen esta semana?");
  assert.equal(joinCompletion("¿Qué lotes ", "vencen esta semana?"), "vencen esta semana?");
  assert.equal(joinCompletion("¿Qué lotes", "¿Qué lotes vencen hoy?"), " vencen hoy?");
  assert.equal(joinCompletion("Cuánto vendimos hoy", "?"), "?");
  assert.equal(joinCompletion("hola", '"  "'), "");
  assert.equal(joinCompletion("a", Array.from({ length: 30 }, (_, i) => `p${i}`).join(" ")).split(" ").length, 15);
  assert.ok(MIN_PREFIX >= 4);
  assert.equal(parseCompleteRequest({ text: "¿Qué ", screen: "lotes" }).screen, "lotes");
  assert.throws(() => parseCompleteRequest({ text: "" }), (err: unknown) => isDomainError(err) && err.code === "400");
});

import { mentionsTita, questionFromMention } from "../src/business-logic/ai/mention";
import { parseTitaAction } from "../src/models/ai";

test("@Tita en el chat y en comentarios: se reconoce la mención y se extrae la pregunta", () => {
  assert.ok(mentionsTita("@Tita ¿qué lotes vencen esta semana?"));
  assert.ok(mentionsTita("Oigan, @tita, ¿cuánto debe Pedro?"));
  assert.ok(!mentionsTita("escriba a tita@finca.co"));
  assert.ok(!mentionsTita("@titania no es Tita"));
  assert.equal(questionFromMention("@Tita, ¿qué lotes vencen esta semana?"), "¿qué lotes vencen esta semana?");
  assert.equal(questionFromMention("@tita"), "");
});

test("PATCH …/tita-actions: índice y estado final de la tarjeta", () => {
  assert.deepEqual(parseTitaAction({ index: 0, status: "done", note: "id 4" }), { index: 0, status: "done", note: "id 4" });
  assert.throws(() => parseTitaAction({ index: 0, status: "running" }), (err: unknown) => isDomainError(err) && err.code === "400");
  assert.throws(() => parseTitaAction({ status: "done" }), (err: unknown) => isDomainError(err) && err.code === "400");
});
