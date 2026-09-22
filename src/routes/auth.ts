import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/index";
import { meController, signinController, signoutController } from "../controllers/auth/index";

/** Demasiados intentos seguidos responde 429 con el código 640 (CU-01). */
const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: ErrorCodes.TOO_MANY_ATTEMPTS },
});

/** Rutas públicas de autenticación: se montan ANTES del middleware authenticate. */
export const authPublicRouter = Router();
authPublicRouter.post("/signin", signinLimiter, signinController);

/** Rutas autenticadas. */
export const authRouter = Router();
authRouter.post("/signout", signoutController);
authRouter.get("/me", meController);
