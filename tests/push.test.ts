import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseDeletePushSubscription, parsePushSubscription } from "../src/models/push";
import { pushEnabled, pushPublicKey } from "../src/business-logic/push/subscriptions";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" }, userAgent: "Chrome" };

test("parsePushSubscription acepta lo que entrega PushManager.subscribe", () => {
  const s = parsePushSubscription(sub);
  assert.equal(s.endpoint, sub.endpoint);
  assert.equal(s.keys.p256dh, sub.keys.p256dh);
  assert.equal(s.keys.auth, sub.keys.auth);
  assert.equal(s.userAgent, "Chrome");
  assert.equal(parsePushSubscription({ ...sub, userAgent: undefined }).userAgent, null);
});

test("parsePushSubscription exige endpoint https y las dos claves", () => {
  assert.deepEqual(paths400(() => parsePushSubscription({ ...sub, endpoint: "http://inseguro" })), ["endpoint"]);
  assert.deepEqual(paths400(() => parsePushSubscription({ endpoint: sub.endpoint })), ["keys"]);
  assert.deepEqual(paths400(() => parsePushSubscription({ endpoint: sub.endpoint, keys: { p256dh: "x", auth: "" } })), ["keys.p256dh", "keys.auth"]);
  assert.deepEqual(paths400(() => parseDeletePushSubscription({})), ["endpoint"]);
  assert.equal(parseDeletePushSubscription({ endpoint: sub.endpoint }).endpoint, sub.endpoint);
});

test("la clave pública solo se expone con el par VAPID completo", () => {
  // La configuración lee el .env local (puede o no traer el par): lo que se prueba es la coherencia.
  const enabled = Boolean(process.env["VAPID_PUBLIC_KEY"]) && Boolean(process.env["VAPID_PRIVATE_KEY"]);
  assert.equal(pushEnabled(), enabled);
  assert.deepEqual(pushPublicKey(), { enabled, publicKey: enabled ? process.env["VAPID_PUBLIC_KEY"] : null });
});
