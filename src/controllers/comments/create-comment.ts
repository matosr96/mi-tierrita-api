import type { RequestHandler } from "express";
import { parseCreateComment } from "../../models/index";
import { requireAuth } from "../../security/index";
import { createComment } from "../../business-logic/comments/index";

/** POST /api/v1/comments — todos los roles (brief 33). */
export const createCommentController: RequestHandler = async (req, res) => {
  const auth = requireAuth(req);
  res.status(201).json(await createComment({ userId: auth.userId, role: auth.role }, parseCreateComment(req.body)));
};
