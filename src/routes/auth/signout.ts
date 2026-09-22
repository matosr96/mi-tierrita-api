import { Router } from "express";
import { requireAuth } from "../../security/index.js";
import { signout } from "../../business-logic/auth/index.js";

export const signoutRoute = Router();

/** POST /api/v1/auth/signout — autenticado. */
signoutRoute.post("/signout", async (req, res) => {
  await signout(requireAuth(req).userId);
  res.status(204).send();
});
