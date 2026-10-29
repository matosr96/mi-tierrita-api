-- 0011 · Auditoría con detalle por registro y comentarios con «responder a»
--
-- Qué cambia: audits gana entity (recurso raíz de la ruta: products, customers, sales…), entity_id (el registro
-- tocado: el id de la ruta o, en una creación, el id que devolvió la respuesta) y changes (JSONB: el cuerpo de la
-- petición sin campos sensibles y un resumen escalar de la respuesta), con índice por (entity, entity_id) para armar
-- la línea de tiempo de un registro. Se crea record_comments: comentarios por registro con respuesta a otro
-- comentario (reply_to_id) y borrado lógico (deleted_at).
-- Por qué: brief de octubre de 2026, punto 33: cada registro guarda quién, cuándo y qué cambió, y admite comentarios
-- con «responder a». Los registros de auditoría anteriores quedan sin detalle (no se puede reconstruir).

ALTER TABLE audits
  ADD COLUMN entity    VARCHAR(40),
  ADD COLUMN entity_id BIGINT,
  ADD COLUMN changes   JSONB;

CREATE INDEX audits_entity_idx ON audits (entity, entity_id);

CREATE TABLE record_comments (
  id          BIGSERIAL PRIMARY KEY,
  entity      VARCHAR(40)   NOT NULL,
  entity_id   BIGINT        NOT NULL,
  user_id     BIGINT        NOT NULL REFERENCES users (id),
  body        VARCHAR(1000) NOT NULL,
  reply_to_id BIGINT        REFERENCES record_comments (id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX record_comments_entity_idx ON record_comments (entity, entity_id, id);
