-- Qué cambia: report_exports gana folio (R-AAAA-NNNNNN, único, de la secuencia report_exports_folio_seq), hash
-- (sha256 que calcula el servidor sobre reporte, formato, filtros, resumen, fecha y persona), filters (los filtros
-- con los que se generó) y summary (los indicadores principales), ambos JSONB.
-- Por qué: brief de octubre de 2026, sección 2.4: portada con QR que lleva a una verificación pública de autenticidad
-- (punto 25) e historial con los filtros estructurados (punto 26). Los registros anteriores reciben folio; su hash
-- queda vacío porque no se puede reconstruir lo que se descargó.

CREATE SEQUENCE report_exports_folio_seq;

ALTER TABLE report_exports
  ADD COLUMN folio   VARCHAR(20) UNIQUE,
  ADD COLUMN hash    CHAR(64),
  ADD COLUMN filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN summary JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE report_exports
   SET folio = 'R-' || to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY') || '-' || lpad(nextval('report_exports_folio_seq')::text, 6, '0')
 WHERE folio IS NULL;

ALTER TABLE report_exports ALTER COLUMN folio SET NOT NULL;
