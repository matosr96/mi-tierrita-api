-- Qué cambia: conversaciones de Tita guardadas por persona (historial) con sus mensajes.
-- Por qué: el brief de octubre de 2026 pide retomar una consulta sin repetirla («Historial» y «Nueva
-- conversación»). Los adjuntos no se guardan (pesan hasta 24 MB): solo su nombre y tipo. Cada tarjeta de
-- acción guarda cómo quedó (confirmada, descartada, fallida) para que Tita no la repita al retomar.

CREATE TABLE ai_conversations (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id),
  title       VARCHAR(120) NOT NULL,
  screen      VARCHAR(40),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_conversations_user_idx ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id  BIGINT NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'event')),
  content          TEXT NOT NULL,
  attachments      JSONB,
  sources          JSONB,
  proposals        JSONB,
  actions          JSONB,
  error            BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, id);
