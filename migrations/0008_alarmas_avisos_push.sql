-- Qué cambia: alarmas personalizadas por persona con su historial de disparos, registro diario de los avisos de
-- vencimiento por rol y suscripciones Web Push por dispositivo.
-- Por qué: el brief de octubre de 2026 (sección 2.2, puntos 12 a 14) pide alarmas con título, hora, repetición y
-- área del sistema que un planificador dispare cada minuto; avisos de lotes y cartera por vencer según el rol, una
-- vez al día; y que el aviso llegue aunque la pestaña esté cerrada (Web Push). La hora de la alarma se guarda como
-- hora local del negocio (BUSINESS_TZ) y `next_fire_at` como instante, que es lo que compara el planificador.

CREATE TABLE alarms (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users (id),
  title          VARCHAR(120) NOT NULL,
  description    VARCHAR(400),
  time_of_day    TIME NOT NULL,
  repeat         VARCHAR(10) NOT NULL CHECK (repeat IN ('ONCE', 'DAILY', 'WEEKDAYS', 'WEEKLY')),
  weekdays       SMALLINT[] NOT NULL DEFAULT '{}',
  date           DATE,
  area           VARCHAR(20),
  active         BOOLEAN NOT NULL DEFAULT true,
  next_fire_at   TIMESTAMPTZ,
  last_fired_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alarms_user_idx ON alarms (user_id, next_fire_at);
CREATE INDEX alarms_due_idx ON alarms (next_fire_at) WHERE active;

CREATE TABLE alarm_fires (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alarm_id  BIGINT NOT NULL REFERENCES alarms (id) ON DELETE CASCADE,
  fired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at   TIMESTAMPTZ
);
CREATE INDEX alarm_fires_alarm_idx ON alarm_fires (alarm_id, fired_at DESC);

-- Un registro por persona y día: el resumen de vencimientos de las 07:00 no se repite aunque la API se reinicie.
CREATE TABLE due_notices (
  user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  notified_on  DATE NOT NULL,
  PRIMARY KEY (user_id, notified_on)
);

CREATE TABLE push_subscriptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
