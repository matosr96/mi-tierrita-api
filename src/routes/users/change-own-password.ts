import { Router } from "express";
import { validate } from "../../common/index.js";
import { requireAuth } from "../../security/index.js";
import { changePasswordSchema } from "../../models/index.js";
import { changeOwnPassword } from "../../business-logic/users/index.js";

export const changeOwnPasswordRoute = Router();

/** PUT /api/v1/users/me/password — autenticado (CU-04). */
changeOwnPasswordRoute.put("/me/password", async (req, res) => {
  const input = validate(changePasswordSchema, req.body);
  await changeOwnPassword(requireAuth(req).userId, input);
  res.status(204).send();
});
