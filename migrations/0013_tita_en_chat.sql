-- Qué cambia: mensajes del chat y comentarios escritos por Tita al ser mencionada (@Tita), con sus tarjetas de acción.
-- Por qué: el brief de octubre de 2026 (punto 7) pide que cualquiera escriba @Tita en un chat del equipo o en el
-- comentario de un registro y ella responda ahí. La respuesta queda a nombre de quien la invocó (user_id) con la marca
-- `tita`; solo esa persona puede confirmar o descartar las tarjetas (`tita_proposals`), y cómo quedaron se guarda en
-- `tita_actions` para que todos lo vean.

ALTER TABLE chat_messages
  ADD COLUMN tita BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tita_proposals JSONB,
  ADD COLUMN tita_actions JSONB;

ALTER TABLE record_comments
  ADD COLUMN tita BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tita_proposals JSONB,
  ADD COLUMN tita_actions JSONB;
