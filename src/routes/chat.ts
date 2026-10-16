import { Router } from "express";
import { createChatMessageController, listChatMessagesController } from "../controllers/chat/index";

/** Chat del equipo: cualquier persona con sesión lee y escribe. */
export const chatRouter = Router();
chatRouter.get("/messages", listChatMessagesController);
chatRouter.post("/messages", createChatMessageController);
