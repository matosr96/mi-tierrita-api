import type { RequestHandler } from "express";
import { parseSearchQuery } from "../../models/index";
import { requireAuth } from "../../security/index";
import { globalSearch } from "../../business-logic/search/index";

/** GET /api/v1/search?q= — todos los roles (brief 29). Devuelve solo los grupos que el rol puede ver. */
export const globalSearchController: RequestHandler = async (req, res) => {
  res.json(await globalSearch(requireAuth(req).role, parseSearchQuery(req.query["q"])));
};
