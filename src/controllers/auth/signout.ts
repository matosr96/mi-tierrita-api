import type { RequestHandler } from "express";
import { requireAuth } from "../../security/index";
import { signout } from "../../business-logic/auth/index";

/** POST /api/v1/auth/signout — autenticado (CU-02). */
export const signoutController: RequestHandler = async (req, res) => {
  await signout(requireAuth(req).userId);
  res.status(204).send();
};
