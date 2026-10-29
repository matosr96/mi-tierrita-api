import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { requireAuth } from "../../security/index";
import { libraryDisposition } from "../../models/index";
import { getLibraryFile } from "../../business-logic/library/index";

/** GET /api/v1/library/:id/file — quien pueda ver el ítem. Imágenes, PDF y texto en línea; el resto como descarga. */
export const getLibraryFileController: RequestHandler = async (req, res) => {
  const file = await getLibraryFile(requireAuth(req).role, parseId(req.params["id"]));
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Length", String(file.data.length));
  res.setHeader("Content-Disposition", `${libraryDisposition(file.mime)}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("ETag", `"${file.updatedAt.getTime()}"`);
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.end(file.data);
};
