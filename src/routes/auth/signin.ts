import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate, ErrorCodes } from "../../common/index.js";
import { signinSchema } from "../../models/index.js";
import { signin } from "../../business-logic/auth/index.js";

/** Demasiados intentos seguidos responde 429 con el código 640 (CU-01). */
const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

export const signinRoute = Router();

/** POST /api/v1/auth/signin — público. */
signinRoute.post("/signin", signinLimiter, async (req, res) => {
  const input = validate(signinSchema, req.body);
  res.status(200).json(await signin(input));
});
