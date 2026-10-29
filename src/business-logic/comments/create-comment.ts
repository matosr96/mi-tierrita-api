import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toCommentResponse, type CommentResponse, type CreateCommentRequest } from "../../models/index";
import type { Role } from "../../security/index";
import { canSeeEntity } from "./comment-access";
import { findCommentById, recordExists } from "./comment-queries";
import { answerTitaComment } from "./tita-reply";

/**
 * Nuevo comentario sobre un registro. El registro debe existir (688) y, si responde a otro comentario, ese
 * comentario debe ser del mismo registro y estar vivo (686).
 */
export const createComment = async (auth: { userId: number; role: Role }, input: CreateCommentRequest): Promise<CommentResponse> => {
  if (!canSeeEntity(auth.role, input.entity)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (!(await recordExists(input.entity, input.entityId))) throw domainError(ErrorCodes.RECORD_NOT_FOUND);
  if (input.replyToId !== null) {
    const parent = await findCommentById(input.replyToId);
    if (parent === undefined) throw domainError(ErrorCodes.COMMENT_NOT_FOUND);
    if (parent.entity !== input.entity || parent.entityId !== input.entityId || parent.deletedAt !== null) throw domainError(ErrorCodes.COMMENT_REPLY_MISMATCH);
  }
  const { rows } = await db.query<{ id: number }>(`INSERT INTO record_comments (entity, entity_id, user_id, body, reply_to_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
    input.entity,
    input.entityId,
    auth.userId,
    input.body,
    input.replyToId,
  ]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("INSERT de comentario no devolvió fila");
  const row = await findCommentById(id);
  if (row === undefined) throw new Error("El comentario recién creado no se encontró");
  // @Tita: responde después, como otro comentario del registro.
  void answerTitaComment({ id, userId: auth.userId, entity: input.entity, entityId: input.entityId, body: input.body });
  return toCommentResponse(row);
};
