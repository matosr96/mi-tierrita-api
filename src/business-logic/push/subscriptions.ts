import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import { config } from "../../server/config";
import { toPushSubscriptionResponse, type PushSubscriptionRequest, type PushSubscriptionResponse, type PushSubscriptionRow } from "../../models/index";

export const PUSH_COLUMNS = `id, user_id AS "userId", endpoint, p256dh, auth, user_agent AS "userAgent", created_at AS "createdAt"`;

/** Push disponible solo con el par VAPID configurado. */
export const pushEnabled = (): boolean => config.push.publicKey !== "" && config.push.privateKey !== "";

export const pushPublicKey = (): { enabled: boolean; publicKey: string | null } => ({ enabled: pushEnabled(), publicKey: pushEnabled() ? config.push.publicKey : null });

/** Guarda la suscripción del dispositivo; si el endpoint ya existía (de esta u otra cuenta), la reemplaza. */
export const savePushSubscription = async (userId: number, input: PushSubscriptionRequest): Promise<PushSubscriptionResponse> => {
  if (!pushEnabled()) throw domainError(ErrorCodes.PUSH_DISABLED);
  const { rows } = await db.query<PushSubscriptionRow>(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent, created_at = now()
     RETURNING ${PUSH_COLUMNS}`,
    [userId, input.endpoint, input.keys.p256dh, input.keys.auth, input.userAgent],
  );
  const row = rows[0];
  if (row === undefined) throw new Error("INSERT de suscripción push no devolvió fila");
  return toPushSubscriptionResponse(row);
};

/** Da de baja el dispositivo (solo si la suscripción es de quien lo pide). */
export const deletePushSubscription = async (userId: number, endpoint: string): Promise<void> => {
  const { rowCount } = await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.PUSH_SUBSCRIPTION_NOT_FOUND);
};

export const listPushSubscriptionsOf = async (userId: number, q: Queryable = db): Promise<PushSubscriptionRow[]> => {
  const { rows } = await q.query<PushSubscriptionRow>(`SELECT ${PUSH_COLUMNS} FROM push_subscriptions WHERE user_id = $1`, [userId]);
  return rows;
};
