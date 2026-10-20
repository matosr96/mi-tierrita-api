import { createValidator } from "../common/validate";
import { ErrorCodes, domainError } from "../common/errors";
import type { Role } from "../security/roles";

/** Chat interno del equipo (prototipo 11). `recipientId` null: canal general; con valor: mensaje privado. */

/** Persona citada en un mensaje (autor de una cita, mencionada o participante de un hilo). */
export type ChatPerson = { id: number; firstName: string; lastName: string };
export type ChatMention = ChatPerson & { username: string };
export type ChatAttachmentInfo = { id: number; name: string; mime: string; size: number };

/** Mensaje citado. `privateReply`: la cita viene del canal general y la respuesta es privada. */
export type ChatQuote = {
  id: number;
  author: ChatPerson;
  body: string;
  attachments: number;
  inThread: boolean;
  privateReply: boolean;
  /** El mensaje citado se eliminó después. */
  deleted: boolean;
};

/** Resumen de un hilo, solo en el mensaje que lo abre. */
export type ChatThreadSummary = { replies: number; unread: number; lastReplyAt: string; participants: ChatPerson[] };

/**
 * Estado de entrega de un mensaje propio: enviado (guardado en el servidor), entregado (llegó a la app de todos los
 * destinatarios activos) y visto (todos lo leyeron). Los conteos permiten "visto por 2 de 3".
 */
export type ChatDeliveryStatus = "sent" | "delivered" | "read";
export type ChatReceiptsSummary = { status: ChatDeliveryStatus; total: number; delivered: number; read: number };

export type ChatMessageRow = {
  id: number;
  clientId: string | null;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  recipientId: number | null;
  body: string;
  createdAt: Date;
  threadRootId: number | null;
  pinnedAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  quoteDeleted: boolean | null;
  pinnedById: number | null;
  pinnedByName: string | null;
  quoteId: number | null;
  quoteUserId: number | null;
  quoteFirstName: string | null;
  quoteLastName: string | null;
  quoteBody: string | null;
  quoteRecipientId: number | null;
  quoteThreadRootId: number | null;
  quoteAttachments: number | null;
  threadReplies: number | null;
  threadUnread: number | null;
  threadLastAt: Date | null;
  threadParticipants: ChatPerson[] | null;
  receiptsTotal: number | null;
  receiptsDelivered: number | null;
  receiptsRead: number | null;
  unreadByMe: boolean;
  mentionsMe: boolean;
  mentions: ChatMention[] | null;
  attachments: ChatAttachmentInfo[] | null;
};

export type ChatMessageResponse = {
  id: number;
  clientId: string | null;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  recipientId: number | null;
  body: string;
  createdAt: string;
  threadRootId: number | null;
  /** Última edición del texto; null si nunca se editó. */
  editedAt: string | null;
  /** Mensaje eliminado: conserva su lugar en la conversación, sin texto ni adjuntos. */
  deleted: boolean;
  replyTo: ChatQuote | null;
  thread: ChatThreadSummary | null;
  pinned: { at: string; by: { id: number; name: string } } | null;
  mentions: ChatMention[];
  attachments: ChatAttachmentInfo[];
  /** Solo en los mensajes propios. */
  receipts: ChatReceiptsSummary | null;
  /** Mensaje de otra persona que quien consulta aún no ha leído. */
  unread: boolean;
  mentionsMe: boolean;
};

const QUOTE_MAX = 160;

export const deliveryStatus = (total: number, delivered: number, read: number): ChatDeliveryStatus =>
  total > 0 && read >= total ? "read" : total > 0 && delivered >= total ? "delivered" : "sent";

export const toChatMessageResponse = (row: ChatMessageRow): ChatMessageResponse => ({
  id: row.id,
  clientId: row.clientId,
  userId: row.userId,
  username: row.username,
  firstName: row.firstName,
  lastName: row.lastName,
  role: row.role,
  recipientId: row.recipientId,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  threadRootId: row.threadRootId,
  editedAt: row.editedAt?.toISOString() ?? null,
  deleted: row.deletedAt !== null,
  replyTo:
    row.quoteId === null
      ? null
      : {
          id: row.quoteId,
          author: { id: row.quoteUserId!, firstName: row.quoteFirstName!, lastName: row.quoteLastName! },
          body: row.quoteBody!.length > QUOTE_MAX ? `${row.quoteBody!.slice(0, QUOTE_MAX - 1)}…` : row.quoteBody!,
          attachments: row.quoteAttachments ?? 0,
          inThread: row.quoteThreadRootId !== null,
          privateReply: row.quoteRecipientId === null && row.recipientId !== null,
          deleted: row.quoteDeleted === true,
        },
  thread:
    row.threadReplies === null || row.threadReplies === 0 || row.threadLastAt === null
      ? null
      : { replies: row.threadReplies, unread: row.threadUnread ?? 0, lastReplyAt: row.threadLastAt.toISOString(), participants: row.threadParticipants ?? [] },
  pinned: row.pinnedAt === null ? null : { at: row.pinnedAt.toISOString(), by: { id: row.pinnedById!, name: row.pinnedByName ?? "" } },
  mentions: row.mentions ?? [],
  attachments: row.attachments ?? [],
  receipts:
    row.receiptsTotal === null
      ? null
      : {
          status: deliveryStatus(row.receiptsTotal, row.receiptsDelivered ?? 0, row.receiptsRead ?? 0),
          total: row.receiptsTotal,
          delivered: row.receiptsDelivered ?? 0,
          read: row.receiptsRead ?? 0,
        },
  unread: row.unreadByMe,
  mentionsMe: row.mentionsMe,
});

/* ---------- entrada ---------- */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CHAT_BODY_MAX = 1000;
export const CHAT_ATTACHMENTS_MAX = 5;

export type CreateChatMessageRequest = {
  body: string;
  recipientId: number | null;
  replyToId: number | null;
  threadRootId: number | null;
  attachmentIds: number[];
  clientId: string | null;
};

export const parseCreateChatMessage = (body: unknown): CreateChatMessageRequest => {
  const v = createValidator(body);
  const text = v.string("body", { max: CHAT_BODY_MAX }, false) ?? "";
  const recipientId = v.number("recipientId", { integer: true, min: 1 }, false);
  const replyToId = v.number("replyToId", { integer: true, min: 1 }, false);
  const threadRootId = v.number("threadRootId", { integer: true, min: 1 }, false);
  const clientId = v.string("clientId", { pattern: UUID_PATTERN, patternMessage: "Debe ser un UUID" }, false);
  const rawIds = typeof body === "object" && body !== null ? (body as Record<string, unknown>)["attachmentIds"] : undefined;
  let ids: number[] = [];
  if (rawIds !== undefined && rawIds !== null) {
    if (!Array.isArray(rawIds) || rawIds.some((n) => typeof n !== "number" || !Number.isInteger(n) || n <= 0)) v.custom("attachmentIds", "Debe ser una lista de ids");
    else if (rawIds.length > CHAT_ATTACHMENTS_MAX) v.custom("attachmentIds", `Máximo ${CHAT_ATTACHMENTS_MAX} adjuntos`);
    else ids = rawIds as number[];
  }
  if (text === "" && ids.length === 0 && !v.issues().some((i) => i.path === "body")) v.custom("body", "Escriba un mensaje o adjunte un archivo");
  if (new Set(ids).size !== ids.length) v.custom("attachmentIds", "Hay adjuntos repetidos");
  v.done();
  return {
    body: text,
    recipientId: recipientId ?? null,
    replyToId: replyToId ?? null,
    threadRootId: threadRootId ?? null,
    attachmentIds: ids,
    clientId: clientId?.toLowerCase() ?? null,
  };
};

/** Editar el texto de un mensaje propio (el cuerpo vacío solo vale si el mensaje lleva adjuntos). */
export const parseEditChatMessage = (body: unknown): { body: string } => {
  const v = createValidator(body);
  const text = v.string("body", { max: CHAT_BODY_MAX });
  v.done();
  return { body: text! };
};

/**
 * Marcar como leído. Sin `threadRootId`, la conversación principal (canal general o privado con `with`); con él, las
 * respuestas de ese hilo. `upTo` limita hasta un mensaje (lo que la persona alcanzó a ver); `includeThreads` marca
 * también todos los hilos de la conversación ("marcar todo como leído").
 */
export type MarkChatReadRequest = { peerId: number | null; threadRootId: number | null; upTo: number | null; includeThreads: boolean };

export const parseMarkChatRead = (body: unknown): MarkChatReadRequest => {
  const v = createValidator(body);
  const peerId = v.number("with", { integer: true, min: 1 }, false);
  const threadRootId = v.number("threadRootId", { integer: true, min: 1 }, false);
  const upTo = v.number("upTo", { integer: true, min: 1 }, false);
  const includeThreads = v.boolean("includeThreads", false);
  v.done();
  return { peerId: peerId ?? null, threadRootId: threadRootId ?? null, upTo: upTo ?? null, includeThreads: includeThreads ?? false };
};

/** Lista de ids de la query (`?ids=1,2,3`), sin repetidos y con tope. */
export const parseIdList = (raw: unknown, max = 100): number[] => {
  if (typeof raw !== "string" || raw.trim() === "") throw domainError(ErrorCodes.VALIDATION, [{ path: "ids", message: "Campo obligatorio" }]);
  const ids = [...new Set(raw.split(",").map((s) => Number(s.trim())))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw domainError(ErrorCodes.VALIDATION, [{ path: "ids", message: "Solo enteros positivos separados por coma" }]);
  if (ids.length > max) throw domainError(ErrorCodes.VALIDATION, [{ path: "ids", message: `Máximo ${max}` }]);
  return ids;
};

/* ---------- adjuntos ---------- */

export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Tipos permitidos: fotos, PDF, documentos de oficina, texto y CSV. Nada ejecutable ni HTML. */
export const CHAT_ATTACHMENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export type UploadChatAttachmentRequest = { name: string; mime: string; data: Buffer };

/** El archivo llega como cuerpo binario; el nombre en `X-File-Name` (codificado con encodeURIComponent). */
export const parseUploadChatAttachment = (input: { body: unknown; contentType: string | undefined; fileName: string | undefined }): UploadChatAttachmentRequest => {
  const issues: { path: string; message: string }[] = [];
  const mime = (input.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (!CHAT_ATTACHMENT_TYPES.includes(mime)) issues.push({ path: "file", message: "Tipo de archivo no permitido (fotos, PDF, Excel, Word, CSV o texto)" });
  let name = "";
  try {
    name = decodeURIComponent(input.fileName ?? "").trim();
  } catch {
    name = "";
  }
  // Sin rutas ni caracteres de control: solo el nombre visible del archivo.
  name = name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").slice(-200);
  if (name === "") issues.push({ path: "name", message: "Falta el nombre del archivo" });
  const data = Buffer.isBuffer(input.body) ? input.body : Buffer.alloc(0);
  if (data.length === 0) issues.push({ path: "file", message: "El archivo está vacío" });
  if (data.length > CHAT_ATTACHMENT_MAX_BYTES) issues.push({ path: "file", message: "Máximo 10 MB por archivo" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  return { name, mime, data };
};

/* ---------- menciones ---------- */

/** Palabras que mencionan a todo el canal general. */
export const EVERYONE_MENTIONS: readonly string[] = ["todos", "equipo"];

/** `@usuario` precedido de inicio o espacio/puntuación; el usuario sigue las reglas de USERNAME_RULE. */
export const extractMentions = (body: string): { usernames: string[]; everyone: boolean } => {
  const found = new Set<string>();
  for (const match of body.matchAll(/(^|[\s(¿¡,;:])@([a-z0-9._-]{2,50})/gi)) found.add(match[2]!.replace(/[.]+$/, "").toLowerCase());
  const everyone = EVERYONE_MENTIONS.some((w) => found.has(w));
  return { usernames: [...found].filter((u) => !EVERYONE_MENTIONS.includes(u)), everyone };
};

/* ---------- equipo, acuses y búsqueda ---------- */

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
  mentions: number;
  lastMessage: ChatPreview;
};
export type ChatTeamResponse = {
  general: { unread: number; mentions: number; lastMessage: ChatPreview };
  members: ChatMemberResponse[];
  onlineCount: number;
  /** Total sin leer (general + privados, con hilos) para la insignia del menú y el título de la pestaña. */
  unreadTotal: number;
};

export type ChatReceiptEntry = { user: ChatPerson & { role: Role; active: boolean }; deliveredAt: string | null; readAt: string | null };
export type ChatReceiptsResponse = { messageId: number; status: ChatDeliveryStatus; read: ChatReceiptEntry[]; delivered: ChatReceiptEntry[]; pending: ChatReceiptEntry[] };

/** Página de mensajes: `hasMoreBefore`/`hasMoreAfter` permiten seguir cargando el historial en cada sentido. */
export type ChatPageResponse = { items: ChatMessageResponse[]; hasMoreBefore: boolean; hasMoreAfter: boolean; root?: ChatMessageResponse };
