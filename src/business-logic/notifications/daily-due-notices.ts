import { todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import { isRole, type Role } from "../../security/index";
import { publishChatEvent } from "../chat/realtime";
import { sendPushTo } from "../push/index";
import { zonedParts } from "../alarms/next-fire";
import { listDueItems } from "./list-due-items";

/** Hora local a partir de la cual se envía el resumen del día. */
export const DUE_NOTICE_HOUR = 7;

type ActiveUser = { id: number; role: string };

/**
 * Resumen diario de vencimientos: a partir de las 07:00 (hora del negocio), a cada persona activa que no lo haya
 * recibido hoy se le publica el evento `due` y una notificación push con lo suyo. `due_notices` guarda a quién se
 * le envió cada día; la inserción con ON CONFLICT decide quién lo manda si corren varias instancias.
 */
export const publishDailyDueNotices = async (now: Date = new Date()): Promise<number> => {
  if (zonedParts(now).hour < DUE_NOTICE_HOUR) return 0;
  const today = todayIso(now);
  const { rows } = await db.query<ActiveUser>(
    `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.active AND NOT EXISTS (SELECT 1 FROM due_notices d WHERE d.user_id = u.id AND d.notified_on = $1)
      ORDER BY u.id`,
    [today],
  );
  let sent = 0;
  for (const u of rows) {
    if (!isRole(u.role)) continue;
    const { rowCount } = await db.query(`INSERT INTO due_notices (user_id, notified_on) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [u.id, today]);
    if ((rowCount ?? 0) === 0) continue;
    const due = await listDueItems(u.role as Role);
    if (due.count === 0) continue;
    await publishChatEvent({ kind: "due", audience: [u.id], count: due.count, summary: due.summary });
    await sendPushTo(u.id, { title: "Vencimientos de hoy", body: due.summary, href: "/", tag: `due-${today}` });
    sent++;
  }
  return sent;
};
