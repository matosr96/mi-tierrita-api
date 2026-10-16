-- 0002 · Funciones del prototipo v4 que el frontend no podía cubrir solo
--
-- Qué cambia:
--   1. users: correo y teléfono opcionales, editables por cada persona en "Mi perfil" (prototipo 15).
--   2. report_exports: historial de reportes descargados en PDF o Excel (prototipo 09). La descarga la arma el
--      cliente; la API solo registra quién descargó qué y cuándo.
--   3. chat_messages: chat interno del equipo (prototipo 11).
--   4. contact_messages: mensajes que deja un visitante en el formulario de la página pública (prototipo 12).
-- Por qué: son las pantallas del prototipo de escritorio v4.2 que necesitaban guardar datos en el servidor.

ALTER TABLE users
  ADD COLUMN email VARCHAR(120),
  ADD COLUMN phone VARCHAR(30);

CREATE TABLE report_exports (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users (id),
  report      VARCHAR(20)  NOT NULL CHECK (report IN ('sales', 'inventory', 'receivables', 'scenario')),
  format      VARCHAR(5)   NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  description VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX report_exports_created_at_idx ON report_exports (created_at DESC);
CREATE INDEX report_exports_user_id_idx    ON report_exports (user_id);

CREATE TABLE chat_messages (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT        NOT NULL REFERENCES users (id),
  body       VARCHAR(1000) NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE contact_messages (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  phone      VARCHAR(30),
  email      VARCHAR(120),
  topic      VARCHAR(80),
  body       VARCHAR(2000) NOT NULL,
  status     VARCHAR(10)   NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'ARCHIVED')),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX contact_messages_status_idx ON contact_messages (status, created_at DESC);
