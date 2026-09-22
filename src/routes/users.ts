import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { changeOwnPasswordController, createUserController, getUserController, listUsersController } from "../controllers/users/index";

export const usersRouter = Router();
usersRouter.put("/me/password", changeOwnPasswordController); // antes de /:id para que "me" no se lea como id
usersRouter.post("/", authorize(Roles.ADMIN), createUserController);
usersRouter.get("/", authorize(Roles.ADMIN), listUsersController);
usersRouter.get("/:id", authorize(Roles.ADMIN), getUserController);
