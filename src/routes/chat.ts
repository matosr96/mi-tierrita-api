import { Router } from "express";
import { chatTeamController, createChatMessageController, listChatMessagesController } from "../controllers/chat/index";

/** Chat del equipo: cualquier persona con sesión lee y escribe en el canal general y en privados. */
export const chatRouter = Router();
chatRouter.get("/messages", listChatMessagesController);
chatRouter.post("/messages", createChatMessageController);
chatRouter.get("/team", chatTeamController);
