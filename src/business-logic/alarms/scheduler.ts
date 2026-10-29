import { db } from "../../data-sources/index";
import { toAlarmResponse, type AlarmRow } from "../../models/index";
import { publishChatEvent } from "../chat/realtime";
import { sendPushTo } from "../push/index";
import { publishDailyDueNotices } from "../notifications/daily-due-notices";
import { ALARM_COLUMNS } from "./find-alarm";
import { nextFireAt, staysActiveAfterFire } from "./next-fire";

/**
 * Planificador de alarmas y avisos (brief 2026, puntos 12 y 13). Cada minuto, alineado al minuto, revisa en una
 * transacción las alarmas activas cuyo `next_fire_at` ya pasó: las marca como disparadas, calcula el siguiente
 * disparo (una de una sola vez se apaga), guarda el disparo en `alarm_fires`, publica el evento en vivo a su dueño y
 * le envía Web Push. Un bloqueo consultivo (`pg_try_advisory_xact_lock`) hace que, con varias instancias de la API,
 * solo una procese cada vuelta. Después, publica el resumen diario de vencimientos si ya son las 07:00.
 */
const ADVISORY_LOCK_KEY = 7_201_026;
const TICK_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

const areaHref = (area: string | null): string => {
  switch (area) {
    case "inicio":
      return "/";
    case "alarmas":
      return "/alarmas";
    case null:
      return "/alarmas";
    default:
      return `/${area}`;
  }
};

type Fired = { alarm: AlarmRow; firedAt: Date };

/** Dispara las alarmas vencidas. Devuelve las disparadas (vacío si otra instancia tenía el turno). */
export const fireDueAlarms = async (now: Date = new Date()): Promise<Fired[]> =>
  db.transaction(async (client) => {
    const { rows: lock } = await client.query<{ locked: boolean }>(`SELECT pg_try_advisory_xact_lock($1) AS locked`, [ADVISORY_LOCK_KEY]);
    if (lock[0]?.locked !== true) return [];
    const { rows } = await client.query<AlarmRow>(`SELECT ${ALARM_COLUMNS} FROM alarms a WHERE a.active AND a.next_fire_at IS NOT NULL AND a.next_fire_at <= $1 ORDER BY a.next_fire_at, a.id FOR UPDATE`, [now]);
    const fired: Fired[] = [];
    for (const alarm of rows) {
      const next = nextFireAt({ timeOfDay: alarm.timeOfDay, repeat: alarm.repeat, weekdays: alarm.weekdays, date: alarm.date }, now);
      const active = staysActiveAfterFire(alarm.repeat) && next !== null;
      await client.query(`UPDATE alarms SET last_fired_at = $2, next_fire_at = $3, active = $4, updated_at = now() WHERE id = $1`, [alarm.id, now, active ? next : null, active]);
      await client.query(`INSERT INTO alarm_fires (alarm_id, fired_at) VALUES ($1, $2)`, [alarm.id, now]);
      fired.push({ alarm, firedAt: now });
    }
    return fired;
  });

/** Avisa a la persona de cada alarma disparada: evento en vivo y push. Nunca lanza. */
const notifyFired = async (fired: Fired[]): Promise<void> => {
  for (const { alarm, firedAt } of fired) {
    const a = toAlarmResponse(alarm);
    await publishChatEvent({ kind: "alarm", audience: [alarm.userId], alarmId: a.id, title: a.title, description: a.description, area: a.area, firedAt: firedAt.toISOString() });
    await sendPushTo(alarm.userId, { title: a.title, body: a.description ?? `Alarma de las ${a.timeOfDay}`, href: areaHref(a.area), tag: `alarm-${a.id}` }).catch(() => undefined);
  }
};

/** Una vuelta del planificador (se puede invocar a mano en pruebas). */
export const runSchedulerTick = async (now: Date = new Date()): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const fired = await fireDueAlarms(now);
    await notifyFired(fired);
    await publishDailyDueNotices(now);
  } catch (err) {
    console.error("El planificador de alarmas falló en esta vuelta:", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
};

/** Arranca el planificador alineado al minuto; el temporizador no mantiene vivo el proceso (`unref`). */
export const startAlarmScheduler = (): void => {
  if (timer !== null) return;
  const msToNextMinute = TICK_MS - (Date.now() % TICK_MS);
  timer = setTimeout(() => {
    void runSchedulerTick();
    timer = setInterval(() => void runSchedulerTick(), TICK_MS);
    timer.unref();
  }, msToNextMinute);
  timer.unref();
  // Primera vuelta al arrancar: lo que venció mientras la API estaba apagada se dispara enseguida.
  void runSchedulerTick();
};

export const stopAlarmScheduler = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
  }
};
