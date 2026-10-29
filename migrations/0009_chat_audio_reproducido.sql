-- 0009 · Chat del equipo: notas de voz (duración del adjunto y acuse de "reproducido")
--
-- Qué cambia:
--   1. chat_attachments.duration_ms: duración de una nota de voz en milisegundos (la manda la app al subirla; los
--      archivos que graba el navegador no siempre traen la duración legible, así que se guarda aparte). Opcional.
--   2. chat_receipts.played_at: cuándo la persona reprodujo la nota de voz del mensaje. Solo puede existir si el
--      mensaje ya le fue entregado (CHECK), igual que read_at.
-- Por qué: los chulitos del chat deben decir, además de entregado y visto, si cada destinatario escuchó la nota de
-- voz (micrófono en verde cuando todos la reprodujeron) y el detalle del mensaje lista "Reproducido por / Falta por
-- reproducir".

ALTER TABLE chat_attachments
  ADD COLUMN duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0);

ALTER TABLE chat_receipts
  ADD COLUMN played_at TIMESTAMPTZ,
  ADD CONSTRAINT chat_receipts_played_after_delivery CHECK (played_at IS NULL OR delivered_at IS NOT NULL);
