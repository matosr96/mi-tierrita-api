import { db } from "../../data-sources/index";

/**
 * Presencia del chat: marca la última petición autenticada de la persona. Se escribe como mucho cada 20 segundos
 * para no tocar la fila en cada petición. No pasa por la auditoría (no es una acción de negocio).
 */
export const touchPresence = async (userId: number): Promise<void> => {
  await db.query(`UPDATE users SET last_seen_at = now() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '20 seconds')`, [userId]);
};
