import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseUpdateOwnProfile } from "../../models/index";
import { updateOwnProfile } from "../../business-logic/users/index";

/** PUT /api/v1/users/me — autenticado (Mi perfil). */
export const updateOwnProfileController: RequestHandler = async (req, res) => {
  res.json(await updateOwnProfile(requireAuth(req).userId, parseUpdateOwnProfile(req.body)));
};
