import { createValidator } from "../common/validate";
import type { Role } from "../security/roles";

/** Chat interno del equipo (prototipo 11). */
/** `recipientId` null: canal general; con valor: mensaje privado. */
export type ChatMessageRow = { id: number; userId: number; username: string; firstName: string; lastName: string; role: Role; recipientId: number | null; body: string; createdAt: Date };

export type ChatMessageResponse = Omit<ChatMessageRow, "createdAt"> & { createdAt: string };

export const toChatMessageResponse = (row: ChatMessageRow): ChatMessageResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type CreateChatMessageRequest = { body: string; recipientId: number | null };

export const parseCreateChatMessage = (body: unknown): CreateChatMessageRequest => {
  const v = createValidator(body);
  const text = v.string("body", { min: 1, max: 1000 });
  const recipientId = v.number("recipientId", { integer: true, min: 1 }, false);
  v.done();
  return { body: text!, recipientId: recipientId ?? null };
};

/** Panel "Equipo" del chat: presencia, no leídos y último mensaje de cada conversación. */
export type ChatPreview = { body: string; createdAt: string; mine: boolean } | null;
export type ChatMemberResponse = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  online: boolean;
  lastSeenAt: string | null;
  unread: number;
  lastMessage: ChatPreview;
};
export type ChatTeamResponse = { general: { unread: number; lastMessage: ChatPreview }; members: ChatMemberResponse[]; onlineCount: number };
