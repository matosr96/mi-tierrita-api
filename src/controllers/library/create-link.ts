import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseCreateLink } from "../../models/index";
import { createLink } from "../../business-logic/library/index";

/** POST /api/v1/library/links — ADMIN. */
export const createLinkController: RequestHandler = async (req, res) => {
  res.status(201).json(await createLink(requireAuth(req).userId, parseCreateLink(req.body)));
};
