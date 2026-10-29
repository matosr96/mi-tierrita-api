import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseAvatarUpload } from "../../models/index";
import { updateOwnAvatar } from "../../business-logic/users/index";

/** PUT /api/v1/users/me/avatar — autenticado (Mi perfil). Cuerpo binario JPEG/PNG/WebP de hasta 1 MB. */
export const updateOwnAvatarController: RequestHandler = async (req, res) => {
  res.json(await updateOwnAvatar(requireAuth(req).userId, parseAvatarUpload({ body: req.body, contentType: req.get("content-type") })));
};
