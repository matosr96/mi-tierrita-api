import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { me } from "../../business-logic/auth/index";

/** GET /api/v1/auth/me — autenticado. */
export const meController: RequestHandler = async (req, res) => {
  res.json(await me(requireAuth(req).userId));
};
