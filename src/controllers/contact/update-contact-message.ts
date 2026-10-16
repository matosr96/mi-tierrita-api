import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateContactMessage } from "../../models/index";
import { updateContactMessage } from "../../business-logic/contact/index";

/** PATCH /api/v1/contact-messages/:id — ADMIN. Cambia el estado (leído, archivado). */
export const updateContactMessageController: RequestHandler = async (req, res) => {
  res.json(await updateContactMessage(parseId(req.params["id"]), parseUpdateContactMessage(req.body)));
};
