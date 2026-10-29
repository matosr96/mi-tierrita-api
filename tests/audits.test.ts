import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeAudit } from "../src/business-logic/audits/describe-audit";
import { isDomainError } from "../src/common/errors";
import { parseAuditEntity } from "../src/models/audits";

/** Detalle de la auditoría por registro (brief de octubre de 2026, punto 33). */

test("describeAudit: entidad e id desde la ruta", () => {
  const d = describeAudit("POST", "/api/v1/products/12/batches", { quantity: 5, expiresAt: "2027-01-01" }, { id: 77, quantity: 5 });
  assert.equal(d.entity, "products");
  assert.equal(d.entityId, 12);
  assert.deepEqual(d.changes, { request: { quantity: 5, expiresAt: "2027-01-01" }, response: { id: 77, quantity: 5 } });
});

test("describeAudit: en una creación el id sale de la respuesta", () => {
  const d = describeAudit("POST", "/api/v1/products?x=1", { name: "Arroz", sku: "AR-1" }, { id: 9, name: "Arroz", category: { id: 2 } });
  assert.equal(d.entity, "products");
  assert.equal(d.entityId, 9);
  // Solo escalares del primer nivel en el resumen de la respuesta.
  assert.deepEqual(d.changes?.response, { id: 9, name: "Arroz" });
});

test("describeAudit: sin id en la ruta ni en la respuesta queda null", () => {
  const d = describeAudit("PUT", "/api/v1/users/me", { firstName: "Ana" }, undefined);
  assert.equal(d.entity, "users");
  assert.equal(d.entityId, null);
  assert.deepEqual(d.changes, { request: { firstName: "Ana" } });
});

test("describeAudit: los campos sensibles se quedan fuera", () => {
  const d = describeAudit("PUT", "/api/v1/users/me/password", { currentPassword: "a", newPassword: "b", note: "ok" }, { token: "xyz", ok: true });
  assert.deepEqual(d.changes, { request: { note: "ok" }, response: { ok: true } });
  const upload = describeAudit("POST", "/api/v1/library", { name: "foto.png", data: "AAAA", mime: "image/png" }, { id: 3 });
  assert.deepEqual(upload.changes?.request, { name: "foto.png", mime: "image/png" });
});

test("describeAudit: textos largos y base64 se truncan o descartan", () => {
  const long = "x".repeat(2001);
  const base64 = Buffer.from("foto de prueba ".repeat(20)).toString("base64");
  const d = describeAudit("POST", "/api/v1/contact", { message: long, photo: base64, short: "hola" }, { id: 1, body: "y".repeat(500) });
  assert.deepEqual(d.changes?.request, { short: "hola" });
  assert.equal((d.changes?.response?.["body"] as string).length, 200);
  assert.equal(d.changes?.response?.["id"], 1);
});

test("describeAudit: sin cuerpo ni respuesta (DELETE) no hay changes", () => {
  const d = describeAudit("DELETE", "/api/v1/comments/4", undefined, undefined);
  assert.deepEqual(d, { entity: "comments", entityId: 4, changes: null });
});

test("parseAuditEntity: solo nombres de recurso en minúsculas", () => {
  assert.equal(parseAuditEntity("products"), "products");
  assert.equal(parseAuditEntity("contact-messages"), "contact-messages");
  for (const bad of ["Products", "a b", "", "x".repeat(41), 3]) {
    assert.throws(() => parseAuditEntity(bad), (err: unknown) => isDomainError(err) && err.code === "400");
  }
});
