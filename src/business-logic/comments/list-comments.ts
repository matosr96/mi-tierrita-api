import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toCommentResponse, type CommentResponse, type CommentRow, type CommentsQuery } from "../../models/index";
import type { Role } from "../../security/index";
import { canSeeEntity } from "./comment-access";
import { COMMENT_COLUMNS, COMMENT_FROM } from "./comment-queries";

/** Comentarios vivos de un registro en orden cronológico. Un rol que no ve el registro recibe 613. */
export const listComments = async (role: Role, query: CommentsQuery): Promise<{ items: CommentResponse[] }> => {
  if (!canSeeEntity(role, query.entity)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const { rows } = await db.query<CommentRow>(`SELECT ${COMMENT_COLUMNS} ${COMMENT_FROM} WHERE c.entity = $1 AND c.entity_id = $2 AND c.deleted_at IS NULL ORDER BY c.id`, [
    query.entity,
    query.entityId,
  ]);
  return { items: rows.map(toCommentResponse) };
};
