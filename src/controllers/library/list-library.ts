import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { requireAuth } from "../../security/index";
import { parseLibraryQuery } from "../../models/index";
import { listLibrary } from "../../business-logic/library/index";

/** GET /api/v1/library?kind=&q=&page=&limit= — cualquier rol (solo lo que su rol puede ver). */
export const listLibraryController: RequestHandler = async (req, res) => {
  res.json(await listLibrary(requireAuth(req).role, parsePageRequest(req.query), parseLibraryQuery(req.query)));
};
