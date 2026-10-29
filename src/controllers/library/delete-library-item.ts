import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { deleteLibraryItem } from "../../business-logic/library/index";

/** DELETE /api/v1/library/:id — ADMIN. */
export const deleteLibraryItemController: RequestHandler = async (req, res) => {
  await deleteLibraryItem(parseId(req.params["id"]));
  res.status(204).send();
};
