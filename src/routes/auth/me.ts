import { Router } from "express";
import { requireAuth } from "../../security/index.js";
import { me } from "../../business-logic/auth/index.js";

export const meRoute = Router();

/** GET /api/v1/auth/me — autenticado. */
meRoute.get("/me", async (req, res) => {
  res.json(await me(requireAuth(req).userId));
});
