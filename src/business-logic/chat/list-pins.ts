import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatMessageResponse } from "../../models/index";
import { findUserById } from "../users/find-user";
import { conversationSql, loadMessages } from "./shared";

/** Mensajes fijados de una conversación, el más reciente primero. */
export const listChatPins = async (userId: number, peerId: number | undefined): Promise<{ items: ChatMessageResponse[] }> => {
  const params: unknown[] = [];
  if (peerId !== undefined) {
    if (peerId === userId || (await findUserById(peerId)) === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
    params.push(userId, peerId);
  }
  const { rows } = await db.query<{ id: number }>(
    `SELECT m.id FROM chat_messages m WHERE ${conversationSql(peerId ?? null, 2)} AND m.pinned_at IS NOT NULL ORDER BY m.pinned_at DESC LIMIT 20`,
    params,
  );
  const items = await loadMessages(userId, rows.map((r) => r.id));
  const order = new Map(rows.map((r, i) => [r.id, i]));
  return { items: items.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
};
