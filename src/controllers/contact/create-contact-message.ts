import type { RequestHandler } from "express";
import { parseCreateContactMessage } from "../../models/index";
import { createContactMessage } from "../../business-logic/contact/index";

/** POST /api/v1/contact — público (formulario de la página pública), con límite de envíos por IP. */
export const createContactMessageController: RequestHandler = async (req, res) => {
  await createContactMessage(parseCreateContactMessage(req.body));
  res.status(202).send();
};
