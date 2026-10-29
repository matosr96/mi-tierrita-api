import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { isHttpUrl, libraryDisposition, parseCreateLink, parseLibraryQuery, parseLibraryUpload, parseUpdateLibraryItem } from "../src/models/library";
import { canSeeLibraryItem } from "../src/business-logic/library/shared";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("parseCreateLink exige título y una dirección http(s)", () => {
  const link = parseCreateLink({ title: " Manual de bodega ", url: "https://ejemplo.com/manual", roles: ["WAREHOUSE", "WAREHOUSE"] });
  assert.equal(link.title, "Manual de bodega");
  assert.equal(link.description, "");
  assert.deepEqual(link.roles, ["WAREHOUSE"]);
  assert.deepEqual(paths400(() => parseCreateLink({ url: "https://ejemplo.com" })), ["title"]);
  assert.deepEqual(paths400(() => parseCreateLink({ title: "x", url: "javascript:alert(1)" })), ["url"]);
  assert.deepEqual(paths400(() => parseCreateLink({ title: "x", url: "ejemplo.com" })), ["url"]);
  assert.deepEqual(paths400(() => parseCreateLink({ title: "x", url: "http://ejemplo.com", roles: ["JEFE"] })), ["roles"]);
  assert.deepEqual(paths400(() => parseCreateLink({ title: "x".repeat(141), url: "http://ejemplo.com" })), ["title"]);
  // Marcar los tres roles equivale a no restringir.
  assert.deepEqual(parseCreateLink({ title: "x", url: "http://a.b", roles: ["ADMIN", "SALES", "WAREHOUSE"] }).roles, []);
  assert.equal(isHttpUrl("ftp://ejemplo.com"), false);
  assert.equal(isHttpUrl("https://ejemplo.com/ruta?x=1"), true);
});

test("parseLibraryUpload acepta los tipos del chat (sin audio), limita el tamaño y valida los roles", () => {
  const ok = parseLibraryUpload({ body: Buffer.from("%PDF-1.4"), contentType: "application/pdf", fileName: encodeURIComponent("Política de crédito.pdf"), title: encodeURIComponent("Política"), description: undefined, roles: encodeURIComponent("ADMIN,SALES") });
  assert.equal(ok.name, "Política de crédito.pdf");
  assert.equal(ok.mime, "application/pdf");
  assert.deepEqual(ok.roles, ["ADMIN", "SALES"]);
  assert.equal(ok.description, "");
  assert.deepEqual(parseLibraryUpload({ body: Buffer.from("a,b"), contentType: "text/csv; charset=utf-8", fileName: "x.csv", title: "x", description: undefined, roles: "" }).roles, []);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.from("x"), contentType: "text/html", fileName: "x.html", title: "x", description: undefined, roles: undefined })), ["file"]);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.from("x"), contentType: "audio/webm", fileName: "x.webm", title: "x", description: undefined, roles: undefined })), ["file"]);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.alloc(10 * 1024 * 1024 + 1), contentType: "application/pdf", fileName: "x.pdf", title: "x", description: undefined, roles: undefined })), ["file"]);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.from("x"), contentType: "application/pdf", fileName: "x.pdf", title: "", description: undefined, roles: undefined })), ["title"]);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.from("x"), contentType: "application/pdf", fileName: "x.pdf", title: "x", description: undefined, roles: "ADMIN,JEFE" })), ["roles"]);
  assert.deepEqual(paths400(() => parseLibraryUpload({ body: Buffer.alloc(0), contentType: "application/pdf", fileName: undefined, title: "x", description: undefined, roles: undefined })), ["name", "file"]);
});

test("parseUpdateLibraryItem exige al menos un campo y valida la dirección", () => {
  assert.deepEqual(parseUpdateLibraryItem({ title: "Nuevo" }), { title: "Nuevo", description: undefined, url: undefined, roles: undefined });
  assert.deepEqual(parseUpdateLibraryItem({ roles: [] }).roles, []);
  assert.deepEqual(paths400(() => parseUpdateLibraryItem({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdateLibraryItem({ url: "mailto:x@y.z" })), ["url"]);
});

test("canSeeLibraryItem: sin roles lo ven todos; con roles, solo esos", () => {
  assert.equal(canSeeLibraryItem("WAREHOUSE", []), true);
  assert.equal(canSeeLibraryItem("WAREHOUSE", ["ADMIN", "SALES"]), false);
  assert.equal(canSeeLibraryItem("SALES", ["ADMIN", "SALES"]), true);
  assert.equal(canSeeLibraryItem("ADMIN", ["WAREHOUSE"]), false);
});

test("libraryDisposition: en línea solo imágenes, PDF y texto", () => {
  assert.equal(libraryDisposition("application/pdf"), "inline");
  assert.equal(libraryDisposition("image/png"), "inline");
  assert.equal(libraryDisposition("text/csv"), "inline");
  assert.equal(libraryDisposition("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "attachment");
  assert.equal(libraryDisposition("application/msword"), "attachment");
});

test("parseLibraryQuery ignora un tipo desconocido y recorta la búsqueda", () => {
  assert.deepEqual(parseLibraryQuery({ kind: "video", q: "  manual " }), { kind: undefined, q: "manual" });
  assert.deepEqual(parseLibraryQuery({ kind: "link" }), { kind: "link", q: undefined });
});
