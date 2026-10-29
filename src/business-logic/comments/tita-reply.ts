import { db } from "../../data-sources/index";
import type { CommentEntity } from "../../models/index";
import { mentionsTita, questionFromMention, replyToMention } from "../ai/mention";

const ENTITY_LABEL: Record<CommentEntity, string> = { products: "producto", customers: "cliente", sales: "venta", suppliers: "proveedor", batches: "lote" };

/**
 * Respuesta de Tita a un comentario que la menciona (@Tita): un comentario más sobre el mismo registro, a nombre de
 * quien preguntó y con la marca `tita`, respondiendo al comentario original. Corre en segundo plano y nunca lanza.
 */
export const answerTitaComment = async (c: { id: number; userId: number; entity: CommentEntity; entityId: number; body: string }): Promise<void> => {
  if (!mentionsTita(c.body)) return;
  try {
    const where = `Mención @Tita en un comentario sobre el ${ENTITY_LABEL[c.entity]} con id ${c.entityId}; consulte ese registro con sus herramientas antes de responder`;
    const reply = await replyToMention(c.userId, questionFromMention(c.body), where);
    await db.query(`INSERT INTO record_comments (entity, entity_id, user_id, body, reply_to_id, tita, tita_proposals) VALUES ($1, $2, $3, $4, $5, true, $6)`, [
      c.entity,
      c.entityId,
      c.userId,
      reply.body,
      c.id,
      JSON.stringify(reply.proposals),
    ]);
  } catch (err) {
    console.error("Tita no pudo responder en un comentario:", err instanceof Error ? err.message : err);
  }
};
