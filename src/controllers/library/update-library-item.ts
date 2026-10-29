import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateLibraryItem } from "../../models/index";
import { updateLibraryItem } from "../../business-logic/library/index";

/** PUT /api/v1/library/:id — ADMIN. */
export const updateLibraryItemController: RequestHandler = async (req, res) => {
  res.json(await updateLibraryItem(parseId(req.params["id"]), parseUpdateLibraryItem(req.body)));
};
