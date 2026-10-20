-- 0005 · Chat del equipo: acuses de entrega y lectura, citas, hilos, fijados, menciones y adjuntos
--
-- Qué cambia:
--   1. chat_messages gana:
--      · client_id: identificador que genera la app para cada envío; con UNIQUE (user_id, client_id) un reintento
--        devuelve el mismo mensaje en vez de duplicarlo.
--      · reply_to_id: mensaje citado (respuesta citando, o respuesta por privado a un mensaje del canal general).
--      · thread_root_id: mensaje que abre el hilo; las respuestas del hilo no se muestran en la conversación principal.
--      · pinned_at / pinned_by: mensaje fijado y quién lo fijó.
--      · el cuerpo puede ir vacío si el mensaje lleva adjuntos (lo valida la lógica de negocio).
--   2. chat_receipts: un acuse por mensaje y destinatario (quién debía recibirlo cuando se envió), con la hora de
--      entrega y la de lectura. Reemplaza a chat_reads (un "leído hasta" por conversación no dice quién leyó qué).
--   3. chat_mentions: personas mencionadas con @usuario en cada mensaje.
--   4. chat_attachments: archivos adjuntos (se guardan en la base; el equipo es pequeño y no hay almacenamiento aparte).
--      message_id nulo = subido pero aún sin enviar; se limpia a las 24 h.
-- Por qué: el chat interno entre administración, secretaría y bodega necesita chulitos de enviado/entregado/visto con
-- el detalle por persona, hilos, respuestas privadas, fijados, menciones, adjuntos y búsqueda.

ALTER TABLE chat_messages
  ADD COLUMN client_id      UUID,
  ADD COLUMN reply_to_id    BIGINT REFERENCES chat_messages (id),
  ADD COLUMN thread_root_id BIGINT REFERENCES chat_messages (id),
  ADD COLUMN pinned_at      TIMESTAMPTZ,
  ADD COLUMN pinned_by      BIGINT REFERENCES users (id),
  ADD CONSTRAINT chat_messages_pin_pair CHECK ((pinned_at IS NULL) = (pinned_by IS NULL)),
  ADD CONSTRAINT chat_messages_thread_not_self CHECK (thread_root_id IS NULL OR thread_root_id <> id);
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;

CREATE UNIQUE INDEX chat_messages_client_unique ON chat_messages (user_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX chat_messages_thread_idx ON chat_messages (thread_root_id, id) WHERE thread_root_id IS NOT NULL;
CREATE INDEX chat_messages_pinned_idx ON chat_messages (pinned_at DESC) WHERE pinned_at IS NOT NULL;

CREATE TABLE chat_receipts (
  message_id   BIGINT      NOT NULL REFERENCES chat_messages (id),
  user_id      BIGINT      NOT NULL REFERENCES users (id),
  delivered_at TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id),
  CHECK (read_at IS NULL OR delivered_at IS NOT NULL)
);
CREATE INDEX chat_receipts_unread_idx      ON chat_receipts (user_id, message_id) WHERE read_at IS NULL;
CREATE INDEX chat_receipts_undelivered_idx ON chat_receipts (user_id) WHERE delivered_at IS NULL;

CREATE TABLE chat_mentions (
  message_id BIGINT NOT NULL REFERENCES chat_messages (id),
  user_id    BIGINT NOT NULL REFERENCES users (id),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX chat_mentions_user_idx ON chat_mentions (user_id, message_id);

CREATE TABLE chat_attachments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT       REFERENCES chat_messages (id),
  user_id    BIGINT       NOT NULL REFERENCES users (id),
  name       VARCHAR(200) NOT NULL,
  mime       VARCHAR(120) NOT NULL,
  size       INTEGER      NOT NULL CHECK (size > 0),
  data       BYTEA        NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX chat_attachments_message_idx ON chat_attachments (message_id);
CREATE INDEX chat_attachments_orphan_idx  ON chat_attachments (created_at) WHERE message_id IS NULL;

-- Acuses del historial: cada mensaje del canal general cuenta como enviado a quienes ya tenían cuenta cuando se
-- escribió; uno privado, a su destinatario. Lo que chat_reads daba por leído queda entregado y leído (con la hora del
-- mensaje, la única disponible); lo demás queda pendiente y se entregará en la próxima conexión.
INSERT INTO chat_receipts (message_id, user_id, delivered_at, read_at)
SELECT m.id, u.id,
       CASE WHEN m.id <= COALESCE(cr.last_read_id, 0) THEN m.created_at END,
       CASE WHEN m.id <= COALESCE(cr.last_read_id, 0) THEN m.created_at END
FROM chat_messages m
JOIN users u ON (m.recipient_id IS NULL AND u.id <> m.user_id AND u.created_at <= m.created_at) OR u.id = m.recipient_id
LEFT JOIN chat_reads cr ON cr.user_id = u.id AND cr.peer_id = CASE WHEN m.recipient_id IS NULL THEN 0 ELSE m.user_id END;

DROP TABLE chat_reads;
