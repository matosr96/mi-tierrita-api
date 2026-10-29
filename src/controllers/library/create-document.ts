import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseLibraryUpload } from "../../models/index";
import { createDocument } from "../../business-logic/library/index";

/**
 * POST /api/v1/library/documents — ADMIN. Cuerpo binario (hasta 10 MB), tipo en Content-Type; `X-File-Name`,
 * `X-Title`, `X-Description` y `X-Roles` codificados con encodeURIComponent.
 */
export const createDocumentController: RequestHandler = async (req, res) => {
  const file = parseLibraryUpload({
    body: req.body,
    contentType: req.get("content-type"),
    fileName: req.get("x-file-name"),
    title: req.get("x-title"),
    description: req.get("x-description"),
    roles: req.get("x-roles"),
  });
  res.status(201).json(await createDocument(requireAuth(req).userId, file));
};
