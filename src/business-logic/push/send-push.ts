import webpush from "web-push";
import { db } from "../../data-sources/index";
import { config } from "../../server/config";
import type { PushPayload } from "../../models/index";
import { listPushSubscriptionsOf, pushEnabled } from "./subscriptions";

let configured = false;
const ensureConfigured = (): void => {
  if (configured) return;
  webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
  configured = true;
};

const isGone = (err: unknown): boolean => {
  const status = (err as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
};

/**
 * Envía una notificación push a todos los dispositivos de una persona. Nunca lanza: un dispositivo que ya no existe
 * (404/410) se da de baja y los demás errores solo se registran. Devuelve cuántos envíos salieron bien.
 */
export const sendPushTo = async (userId: number, payload: PushPayload): Promise<number> => {
  if (!pushEnabled()) return 0;
  ensureConfigured();
  const subscriptions = await listPushSubscriptionsOf(userId);
  let sent = 0;
  for (const s of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (err) {
      if (isGone(err)) {
        await db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [s.id]).catch(() => undefined);
      } else {
        console.error("No se pudo enviar una notificación push:", err instanceof Error ? err.message : err);
      }
    }
  }
  return sent;
};
