import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getUserAvatar } from "../../business-logic/users/index";

/** GET /api/v1/users/:id/avatar — cualquier rol. 691 si la persona no tiene foto. Caché privada corta con ETag. */
export const getUserAvatarController: RequestHandler = async (req, res) => {
  const avatar = await getUserAvatar(parseId(req.params["id"]));
  const etag = `"${avatar.updatedAt.getTime()}"`;
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("ETag", etag);
  if (req.get("if-none-match") === etag) {
    res.status(304).end();
    return;
  }
  res.setHeader("Content-Type", avatar.mime);
  res.setHeader("Content-Length", String(avatar.data.length));
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.end(avatar.data);
};
