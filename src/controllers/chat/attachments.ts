import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseUploadChatAttachment } from "../../models/index";
import { getChatAttachment, uploadChatAttachment } from "../../business-logic/chat/index";

/** POST /api/v1/chat/attachments — autenticado. Cuerpo binario (hasta 10 MB), tipo en Content-Type y nombre en X-File-Name. */
export const uploadChatAttachmentController: RequestHandler = async (req, res) => {
  const file = parseUploadChatAttachment({ body: req.body, contentType: req.get("content-type"), fileName: req.get("x-file-name") });
  res.status(201).json(await uploadChatAttachment(requireAuth(req).userId, file));
};

/** Solo las imágenes se muestran en línea; lo demás se descarga (nunca se interpreta en el navegador). */
const INLINE = /^image\/(jpeg|png|webp|gif)$/;

/** GET /api/v1/chat/attachments/:id — quien puede ver el mensaje que lo lleva. */
export const getChatAttachmentController: RequestHandler = async (req, res) => {
  const file = await getChatAttachment(requireAuth(req).userId, parseId(req.params["id"]));
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Length", String(file.data.length));
  res.setHeader("Content-Disposition", `${INLINE.test(file.mime) ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.end(file.data);
};
