import { createValidator } from "../common/validate";

/**
 * Suscripciones Web Push (brief de octubre de 2026, punto 14): lo que entrega `PushManager.subscribe` en el navegador.
 * Una por dispositivo/navegador; el endpoint es la clave.
 */
export type PushSubscriptionRow = { id: number; userId: number; endpoint: string; p256dh: string; auth: string; userAgent: string | null; createdAt: Date };

export type PushSubscriptionResponse = { id: number; endpoint: string; userAgent: string | null; createdAt: string };

export const toPushSubscriptionResponse = (row: PushSubscriptionRow): PushSubscriptionResponse => ({
  id: row.id,
  endpoint: row.endpoint,
  userAgent: row.userAgent,
  createdAt: row.createdAt.toISOString(),
});

export type PushSubscriptionRequest = { endpoint: string; keys: { p256dh: string; auth: string }; userAgent: string | null };

const ENDPOINT_RULE = { min: 12, max: 2000, pattern: /^https:\/\//, patternMessage: "Debe ser una URL https" };

export const parsePushSubscription = (body: unknown): PushSubscriptionRequest => {
  const v = createValidator(body);
  const endpoint = v.string("endpoint", ENDPOINT_RULE);
  const userAgent = v.string("userAgent", { max: 200 }, false);
  const raw = typeof body === "object" && body !== null ? (body as { keys?: unknown }).keys : undefined;
  let p256dh: string | undefined;
  let auth: string | undefined;
  if (typeof raw !== "object" || raw === null) {
    v.custom("keys", "Campo obligatorio");
  } else {
    const k = createValidator(raw, "keys");
    p256dh = k.string("p256dh", { min: 10, max: 300 });
    auth = k.string("auth", { min: 4, max: 100 });
    for (const issue of k.issues()) v.custom(issue.path, issue.message);
  }
  v.done();
  return { endpoint: endpoint!, keys: { p256dh: p256dh!, auth: auth! }, userAgent: userAgent === undefined || userAgent === "" ? null : userAgent };
};

export type DeletePushSubscriptionRequest = { endpoint: string };

export const parseDeletePushSubscription = (body: unknown): DeletePushSubscriptionRequest => {
  const v = createValidator(body);
  const endpoint = v.string("endpoint", ENDPOINT_RULE);
  v.done();
  return { endpoint: endpoint! };
};

/** Lo que viaja dentro de una notificación push (el service worker de la app lo muestra tal cual). */
export type PushPayload = { title: string; body: string; href: string; tag: string };
