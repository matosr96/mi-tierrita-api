import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { listDirectory } from "../../business-logic/users/index";

/** GET /api/v1/users/directory — cualquier rol. Personas con rol, contacto y presencia; inactivas solo para ADMIN. */
export const directoryController: RequestHandler = async (req, res) => {
  res.json(await listDirectory(requireAuth(req).role));
};
