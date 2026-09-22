import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { parseChangePassword } from "../../models/index";
import { changeOwnPassword } from "../../business-logic/users/index";

/** PUT /api/v1/users/me/password — autenticado (CU-04). */
export const changeOwnPasswordController: RequestHandler = async (req, res) => {
  await changeOwnPassword(requireAuth(req).userId, parseChangePassword(req.body));
  res.status(204).send();
};
