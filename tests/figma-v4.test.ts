import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseUpdateOwnProfile } from "../src/models/users";
import { parseCreateContactMessage, parseUpdateContactMessage } from "../src/models/contact";
import { parseCreateReportExport } from "../src/models/exports";
import { parseCreateChatMessage } from "../src/models/chat";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("parseUpdateOwnProfile normaliza el correo y permite borrar el teléfono con null o vacío", () => {
  assert.deepEqual(parseUpdateOwnProfile({ email: " Ana@Finca.CO ", phone: null }), { firstName: undefined, lastName: undefined, email: "ana@finca.co", phone: null });
  assert.deepEqual(parseUpdateOwnProfile({ phone: "" }), { firstName: undefined, lastName: undefined, email: undefined, phone: null });
});

test("parseUpdateOwnProfile rechaza un cuerpo vacío y un correo inválido sin duplicar mensajes", () => {
  assert.deepEqual(paths400(() => parseUpdateOwnProfile({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdateOwnProfile({ email: "malo" })), ["email"]);
});

test("parseCreateContactMessage exige un teléfono o un correo para responder", () => {
  assert.ok(paths400(() => parseCreateContactMessage({ name: "Ana", body: "Hola, quiero precios" })).includes("phone"));
  const ok = parseCreateContactMessage({ name: "Ana", email: "ANA@x.co", body: "Hola, quiero precios" });
  assert.equal(ok.email, "ana@x.co");
  assert.equal(ok.trap, false);
});

test("parseCreateContactMessage marca como trampa cuando llega el campo oculto", () => {
  assert.equal(parseCreateContactMessage({ name: "Bot", phone: "3001234567", body: "spam spam", website: "http://x" }).trap, true);
});

test("estados y exportaciones solo aceptan los valores conocidos", () => {
  assert.deepEqual(paths400(() => parseUpdateContactMessage({ status: "BORRADO" })), ["status"]);
  assert.deepEqual(parseCreateReportExport({ report: "sales", format: "pdf", description: "Ventas" }), { report: "sales", format: "pdf", description: "Ventas" });
  assert.deepEqual(paths400(() => parseCreateReportExport({ report: "ventas", format: "doc", description: "" })), ["report", "format", "description"]);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "   " })), ["body"]);
});

test("parseCreateChatMessage acepta un destinatario opcional para mensajes privados", () => {
  assert.deepEqual(parseCreateChatMessage({ body: "Hola" }), { body: "Hola", recipientId: null });
  assert.deepEqual(parseCreateChatMessage({ body: "Hola", recipientId: 3 }), { body: "Hola", recipientId: 3 });
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "Hola", recipientId: 0 })), ["recipientId"]);
});
