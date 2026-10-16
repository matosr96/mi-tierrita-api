-- 0004 · Marca de "sugerido por IA" en la auditoría
--
-- Qué cambia: audits.ai_suggested indica que la escritura la confirmó una persona a partir de un borrador del
-- asistente (venta, abono o compra prellenados). Quien firma sigue siendo la persona (user_id).
-- Por qué: la IA propone y la persona confirma; la auditoría debe distinguir esas operaciones sin cambiar de autor.

ALTER TABLE audits ADD COLUMN ai_suggested BOOLEAN NOT NULL DEFAULT false;
