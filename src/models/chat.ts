import { createValidator } from "../common/validate";
import type { Role } from "../security/roles";

/** Chat interno del equipo (prototipo 11). */
export type ChatMessageRow = { id: number; userId: number; username: string; firstName: string; lastName: string; role: Role; body: string; createdAt: Date };

export type ChatMessageResponse = Omit<ChatMessageRow, "createdAt"> & { createdAt: string };

export const toChatMessageResponse = (row: ChatMessageRow): ChatMessageResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type CreateChatMessageRequest = { body: string };

export const parseCreateChatMessage = (body: unknown): CreateChatMessageRequest => {
  const v = createValidator(body);
  const text = v.string("body", { min: 1, max: 1000 });
  v.done();
  return { body: text! };
};
