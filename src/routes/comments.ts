import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import { createCommentController, deleteCommentController, listCommentsController, setCommentTitaActionController } from "../controllers/comments/index";

/** Comentarios por registro: los tres roles; qué registros puede comentar cada rol lo decide la lógica (canSeeEntity). */
export const commentsRouter = Router();
commentsRouter.use(authorize(...ALL_ROLES));
commentsRouter.get("/", listCommentsController);
commentsRouter.post("/", createCommentController);
commentsRouter.delete("/:id", deleteCommentController);
commentsRouter.patch("/:id/tita-actions", setCommentTitaActionController);
