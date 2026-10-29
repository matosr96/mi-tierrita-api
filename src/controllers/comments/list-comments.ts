import type { RequestHandler } from "express";
import { parseCommentsQuery } from "../../models/index";
import { requireAuth } from "../../security/index";
import { listComments } from "../../business-logic/comments/index";

/** GET /api/v1/comments?entity=&entityId= — todos los roles; el permiso por tipo de registro se valida en la lógica. */
export const listCommentsController: RequestHandler = async (req, res) => {
  res.json(await listComments(requireAuth(req).role, parseCommentsQuery(req.query)));
};
