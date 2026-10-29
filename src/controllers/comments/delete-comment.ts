import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { deleteComment } from "../../business-logic/comments/index";

/** DELETE /api/v1/comments/:id — el autor o ADMIN; borrado lógico. */
export const deleteCommentController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  await deleteComment({ userId: auth.userId, role: auth.role }, parseId(req.params["id"]));
  res.status(204).end();
};
