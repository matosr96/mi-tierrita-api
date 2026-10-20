-- 0006 · Chat del equipo: editar y eliminar mensajes
--
-- Qué cambia: chat_messages.edited_at (última edición del texto) y deleted_at / deleted_by (mensaje eliminado y quién
-- lo eliminó). Un mensaje eliminado no se borra de la tabla: conserva su lugar en la conversación, sus acuses y sus
-- hilos, pero pierde el texto, las menciones, los adjuntos y el fijado ("Se eliminó este mensaje").
-- Por qué: el equipo necesita corregir un mensaje mal escrito o retirar uno enviado por error sin romper el historial.

ALTER TABLE chat_messages
  ADD COLUMN edited_at  TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by BIGINT REFERENCES users (id),
  ADD CONSTRAINT chat_messages_deleted_pair CHECK ((deleted_at IS NULL) = (deleted_by IS NULL));
