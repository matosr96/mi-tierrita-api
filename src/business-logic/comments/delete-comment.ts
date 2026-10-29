import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { Role } from "../../security/index";
import { canDeleteComment } from "./comment-access";
import { findCommentById } from "./comment-queries";

/** Borrado lógico: el comentario deja de listarse y las respuestas que lo citan muestran «comentario eliminado». */
export const deleteComment = async (auth: { userId: number; role: Role }, id: number): Promise<void> => {
  const comment = await findCommentById(id);
  if (comment === undefined || comment.deletedAt !== null) throw domainError(ErrorCodes.COMMENT_NOT_FOUND);
  if (!canDeleteComment(auth.role, auth.userId, comment)) throw domainError(ErrorCodes.COMMENT_NOT_OWNER);
  await db.query(`UPDATE record_comments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
};
