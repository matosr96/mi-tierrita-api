import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { removeOwnAvatar } from "../../business-logic/users/index";

/** DELETE /api/v1/users/me/avatar — autenticado (Mi perfil). */
export const removeOwnAvatarController: RequestHandler = async (req, res) => {
  res.json(await removeOwnAvatar(requireAuth(req).userId));
};
