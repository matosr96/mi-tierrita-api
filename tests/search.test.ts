import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { groupsFor, parseSearchQuery } from "../src/models/search";

/** Búsqueda global (brief de octubre de 2026, punto 29). */

test("parseSearchQuery: exige al menos dos caracteres y recorta espacios", () => {
  assert.equal(parseSearchQuery("  arroz "), "arroz");
  assert.equal(parseSearchQuery("ab"), "ab");
  for (const bad of ["a", " a ", "", undefined, null, 12]) {
    assert.throws(() => parseSearchQuery(bad), (err: unknown) => isDomainError(err) && err.code === "400");
  }
});

test("parseSearchQuery: acota el texto a 100 caracteres", () => {
  assert.equal(parseSearchQuery("x".repeat(300)).length, 100);
});

test("groupsFor: cada rol ve solo los grupos de su matriz", () => {
  assert.deepEqual(groupsFor("ADMIN"), ["products", "customers", "people", "suppliers"]);
  assert.deepEqual(groupsFor("SALES"), ["products", "customers", "people"]);
  assert.deepEqual(groupsFor("WAREHOUSE"), ["products", "people", "suppliers"]);
});
