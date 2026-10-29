import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import {
  chatMessageReceiptsController,
  chatMessagesStateController,
  chatStreamController,
  chatTeamController,
  createChatMessageController,
  deleteChatMessageController,
  editChatMessageController,
  getChatAttachmentController,
  listChatMediaController,
  listChatMessagesController,
  listChatPinsController,
  markChatPlayedController,
  markChatReadController,
  pinChatMessageController,
  searchChatMessagesController,
  unpinChatMessageController,
  uploadChatAttachmentController,
  setChatTitaActionController,
} from "../controllers/chat/index";

/**
 * Chat del equipo: los tres roles leen y escriben en el canal general y en sus privados. La privacidad (quién ve qué
 * mensaje, adjunto o acuse) y el permiso de fijar en el canal general (ADMIN) se aplican en la lógica de negocio.
 */
export const chatRouter = Router();
chatRouter.use(authorize(...ALL_ROLES));
chatRouter.get("/stream", chatStreamController);
chatRouter.get("/team", chatTeamController);
chatRouter.get("/search", searchChatMessagesController);
chatRouter.get("/pins", listChatPinsController);
chatRouter.get("/media", listChatMediaController);
chatRouter.post("/read", markChatReadController);
chatRouter.post("/attachments", uploadChatAttachmentController);
chatRouter.get("/attachments/:id", getChatAttachmentController);
chatRouter.get("/messages/state", chatMessagesStateController);
chatRouter.get("/messages", listChatMessagesController);
chatRouter.post("/messages", createChatMessageController);
chatRouter.patch("/messages/:id", editChatMessageController);
chatRouter.delete("/messages/:id", deleteChatMessageController);
chatRouter.get("/messages/:id/receipts", chatMessageReceiptsController);
chatRouter.post("/messages/:id/played", markChatPlayedController);
chatRouter.patch("/messages/:id/tita-actions", setChatTitaActionController);
chatRouter.put("/messages/:id/pin", pinChatMessageController);
chatRouter.delete("/messages/:id/pin", unpinChatMessageController);
