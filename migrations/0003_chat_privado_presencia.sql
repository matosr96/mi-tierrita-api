-- 0003 · Mensajes privados, no leídos y presencia en el chat del equipo
--
-- Qué cambia:
--   1. chat_messages.recipient_id: NULL es el canal general; con valor, un mensaje privado entre dos personas.
--   2. chat_reads: hasta qué mensaje leyó cada persona en cada conversación (peer_id 0 = canal general), para
--      contar los no leídos.
--   3. users.last_seen_at y users.last_signout_at: última petición autenticada y último cierre de sesión, para
--      mostrar quién está en línea y su última conexión.
-- Por qué: el prototipo 11 (Chat del equipo) tiene mensajes privados y el panel "Equipo" con en línea / desconectados.

ALTER TABLE chat_messages ADD COLUMN recipient_id BIGINT REFERENCES users (id);
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_not_self CHECK (recipient_id IS NULL OR recipient_id <> user_id);
CREATE INDEX chat_messages_general_idx ON chat_messages (id) WHERE recipient_id IS NULL;
CREATE INDEX chat_messages_pair_idx    ON chat_messages (LEAST(user_id, recipient_id), GREATEST(user_id, recipient_id), id) WHERE recipient_id IS NOT NULL;

CREATE TABLE chat_reads (
  user_id      BIGINT NOT NULL REFERENCES users (id),
  peer_id      BIGINT NOT NULL DEFAULT 0,
  last_read_id BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, peer_id)
);

ALTER TABLE users
  ADD COLUMN last_seen_at    TIMESTAMPTZ,
  ADD COLUMN last_signout_at TIMESTAMPTZ;
