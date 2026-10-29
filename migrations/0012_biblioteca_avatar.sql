-- 0012 · Foto de perfil y biblioteca de documentos y enlaces
--
-- Qué cambia:
--   1. users gana avatar (foto reducida por la app a 256×256, JPEG/PNG/WebP, hasta 1 MB), avatar_mime y
--      avatar_updated_at (sirve de ETag y de clave de caché en la app).
--   2. library_items: la biblioteca del equipo. Un ítem es un documento (archivo guardado en la base, como los
--      adjuntos del chat: el equipo es pequeño y no hay almacenamiento aparte) o un enlace (url). `roles` dice qué
--      roles lo ven; vacío = todos. Solo el administrador crea, edita y elimina.
-- Por qué: brief de octubre de 2026, sección 2.5: perfil editable con foto (punto 34) y un lugar único con los
-- documentos y enlaces importantes, con vista previa (punto 35).

ALTER TABLE users
  ADD COLUMN avatar            BYTEA,
  ADD COLUMN avatar_mime       VARCHAR(60),
  ADD COLUMN avatar_updated_at TIMESTAMPTZ,
  ADD CONSTRAINT users_avatar_pair CHECK ((avatar IS NULL) = (avatar_mime IS NULL) AND (avatar IS NULL) = (avatar_updated_at IS NULL));

CREATE TABLE library_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        VARCHAR(10)  NOT NULL CHECK (kind IN ('document', 'link')),
  title       VARCHAR(140) NOT NULL,
  description VARCHAR(400) NOT NULL DEFAULT '',
  url         TEXT,
  name        VARCHAR(200),
  mime        VARCHAR(120),
  size        INTEGER      CHECK (size IS NULL OR size > 0),
  data        BYTEA,
  roles       TEXT[]       NOT NULL DEFAULT '{}',
  created_by  BIGINT       NOT NULL REFERENCES users (id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT library_items_shape CHECK (
    (kind = 'link' AND url IS NOT NULL AND data IS NULL AND name IS NULL AND mime IS NULL AND size IS NULL)
    OR (kind = 'document' AND url IS NULL AND data IS NOT NULL AND name IS NOT NULL AND mime IS NOT NULL AND size IS NOT NULL)
  )
);
CREATE INDEX library_items_kind_idx ON library_items (kind, created_at DESC);
