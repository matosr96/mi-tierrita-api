import { Router } from "express";
import { authorize, ALL_ROLES, Roles } from "../security/index";
import {
  changeOwnPasswordController,
  createUserController,
  directoryController,
  getUserAvatarController,
  getUserController,
  listUsersController,
  removeOwnAvatarController,
  updateOwnAvatarController,
  updateOwnProfileController,
} from "../controllers/users/index";

export const usersRouter = Router();
usersRouter.put("/me/password", changeOwnPasswordController); // antes de /:id para que "me" no se lea como id
usersRouter.put("/me/avatar", updateOwnAvatarController);
usersRouter.delete("/me/avatar", removeOwnAvatarController);
usersRouter.put("/me", updateOwnProfileController);
usersRouter.post("/", authorize(Roles.ADMIN), createUserController);
usersRouter.get("/", authorize(Roles.ADMIN), listUsersController);
usersRouter.get("/directory", authorize(...ALL_ROLES), directoryController); // fija, antes de /:id
usersRouter.get("/:id/avatar", authorize(...ALL_ROLES), getUserAvatarController);
usersRouter.get("/:id", authorize(Roles.ADMIN), getUserController);
