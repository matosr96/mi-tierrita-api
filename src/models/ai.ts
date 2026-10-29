import { createValidator } from "../common/validate";

/** Adjunto de la última pregunta: imagen o PDF en base64, o texto ya extraído en el navegador (CSV, Excel, .txt). */
export type ChatAttachment =
  | { kind: "image"; name: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }
  | { kind: "pdf"; name: string; data: string }
  | { kind: "text"; name: string; text: string };
export type ChatTurn = { role: "user" | "assistant"; content: string; attachments?: ChatAttachment[] };
export const MAX_ATTACHMENTS = 4;
export type InvoiceImageInput = { image: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
export const DRAFT_KINDS = ["collection_message", "contact_reply", "report_summary", "scenario_explain"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];
export type DraftRequest = { kind: DraftKind; customerId?: number | undefined; contactId?: number | undefined; scenarioId?: number | undefined; from?: string | undefined; to?: string | undefined };

/** Asistente de IA: la conversación viaja completa en cada pregunta; el servidor guarda la última pregunta y su respuesta. */
export const MAX_TURNS = 20;

/** Pantallas de la app que Tita puede recibir como contexto (la ruta sin parámetros). */
export const SCREENS = ["inicio", "inventario", "lotes", "ventas", "clientes", "proveedores", "finanzas", "reportes", "tita", "chat", "contactos", "usuarios", "auditoria", "alarmas", "perfil"] as const;
export type Screen = (typeof SCREENS)[number];

/**
 * Petición completa de `POST /ai/chat`: los turnos, si la respuesta va en dos pasos (`asincrono: true` → 202 con
 * `tareaId`), la conversación guardada a la que pertenece la pregunta y la pantalla desde la que se pregunta.
 */
export type AssistantChatRequest = { messages: ChatTurn[]; asincrono: boolean; conversationId?: number | undefined; screen?: Screen | undefined };

/** Nota de la conversación guardada (una tarjeta confirmada o descartada) y, si aplica, el estado de esa tarjeta. */
export type ConversationEventRequest = { content: string; messageId?: number | undefined; index?: number | undefined; status?: ActionStatus | undefined; note?: string | undefined };
export const ACTION_STATUSES = ["idle", "running", "done", "failed", "dismissed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** Mensaje tal como se guarda y se devuelve en el historial (los adjuntos solo con nombre y tipo). */
export type StoredAttachment = { kind: ChatAttachment["kind"]; name: string };
export type AiMessageRow = {
  id: number;
  role: "user" | "assistant" | "event";
  content: string;
  attachments: StoredAttachment[] | null;
  sources: unknown[] | null;
  proposals: unknown[] | null;
  actions: Record<string, { status: ActionStatus; note?: string }> | null;
  error: boolean;
  createdAt: Date;
};
export type AiMessageResponse = Omit<AiMessageRow, "createdAt"> & { createdAt: string };
export const toAiMessageResponse = (row: AiMessageRow): AiMessageResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type AiConversationRow = { id: number; title: string; screen: Screen | null; messages: number; createdAt: Date; updatedAt: Date };
export type AiConversationResponse = Omit<AiConversationRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export const toAiConversationResponse = (row: AiConversationRow): AiConversationResponse => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

const BASE64 = /^[A-Za-z0-9+/=]+$/;

export const parseAssistantChat = (body: unknown): ChatTurn[] => {
  const v = createValidator(body);
  const turns = v.array<ChatTurn>("messages", { min: 1, max: MAX_TURNS }, (item) => {
    const role = item.oneOf("role", ["user", "assistant"] as const);
    const content = item.string("content", { min: 1, max: 4000 });
    const attachments = item.array<ChatAttachment>(
      "attachments",
      { min: 0, max: MAX_ATTACHMENTS },
      (a) => {
        const kind = a.oneOf("kind", ["image", "pdf", "text"] as const);
        const name = a.string("name", { min: 1, max: 160 });
        if (kind === "text") {
          const text = a.string("text", { min: 1, max: 200_000, trim: false });
          return name === undefined || text === undefined ? undefined : { kind, name, text };
        }
        const data = a.string("data", { min: 100, max: 11_000_000, trim: false });
        if (data !== undefined && !BASE64.test(data)) a.custom("data", "Debe ser base64 sin encabezado data:");
        if (kind === "image") {
          const mediaType = a.oneOf("mediaType", ["image/jpeg", "image/png", "image/webp"] as const);
          return name === undefined || data === undefined || mediaType === undefined ? undefined : { kind, name, mediaType, data };
        }
        return kind === undefined || name === undefined || data === undefined ? undefined : { kind: "pdf", name, data };
      },
      false,
    );
    return role === undefined || content === undefined ? undefined : { role, content, ...(attachments && attachments.length > 0 ? { attachments } : {}) };
  });
  if (turns !== undefined && turns.length > 0 && turns[turns.length - 1]?.role !== "user") v.custom("messages", "El último mensaje debe ser de la persona");
  v.done();
  return turns!;
};

export const parseAssistantChatRequest = (body: unknown): AssistantChatRequest => {
  const messages = parseAssistantChat(body);
  const v = createValidator(body);
  const asincrono = v.boolean("asincrono", false) ?? false;
  const conversationId = v.number("conversationId", { integer: true, min: 1 }, false);
  const screen = v.oneOf("screen", SCREENS, false);
  v.done();
  return { messages, asincrono, conversationId, screen };
};

/** `PATCH /chat/messages/:id/tita-actions` y `PATCH /comments/:id/tita-actions`: cómo quedó una tarjeta de Tita. */
export const TITA_ACTION_STATUSES = ["done", "failed", "dismissed"] as const;
export const parseTitaAction = (body: unknown): { index: number; status: (typeof TITA_ACTION_STATUSES)[number]; note?: string | undefined } => {
  const v = createValidator(body);
  const index = v.number("index", { integer: true, min: 0, max: 50 });
  const status = v.oneOf("status", TITA_ACTION_STATUSES);
  const note = v.string("note", { min: 1, max: 300 }, false);
  v.done();
  return { index: index!, status: status!, note };
};

export type CompleteRequest = { text: string; screen?: Screen | undefined };
export const parseCompleteRequest = (body: unknown): CompleteRequest => {
  const v = createValidator(body);
  const text = v.string("text", { min: 1, max: 600, trim: false });
  const screen = v.oneOf("screen", SCREENS, false);
  v.done();
  return { text: text!, screen };
};

export const parseConversationEvent = (body: unknown): ConversationEventRequest => {
  const v = createValidator(body);
  const content = v.string("content", { min: 1, max: 600 });
  const messageId = v.number("messageId", { integer: true, min: 1 }, false);
  const index = v.number("index", { integer: true, min: 0, max: 50 }, false);
  const status = v.oneOf("status", ACTION_STATUSES, false);
  const note = v.string("note", { min: 1, max: 300 }, false);
  if ((messageId === undefined) !== (index === undefined)) v.custom("messageId", "messageId e index van juntos");
  if (status !== undefined && messageId === undefined) v.custom("status", "Requiere messageId e index");
  v.done();
  return { content: content!, messageId, index, status, note };
};

export const parseInvoiceImage = (body: unknown): InvoiceImageInput => {
  const v = createValidator(body);
  const mediaType = v.oneOf("mediaType", ["image/jpeg", "image/png", "image/webp"] as const);
  const image = v.string("image", { min: 100, max: 7_500_000 });
  if (image !== undefined && !/^[A-Za-z0-9+/=]+$/.test(image)) v.custom("image", "Debe ser base64 sin encabezado data:");
  v.done();
  return { mediaType: mediaType!, image: image! };
};

export const parseDraftRequest = (body: unknown): DraftRequest => {
  const v = createValidator(body);
  const kind = v.oneOf<DraftKind>("kind", DRAFT_KINDS);
  const customerId = v.number("customerId", { integer: true, min: 1 }, false);
  const contactId = v.number("contactId", { integer: true, min: 1 }, false);
  const scenarioId = v.number("scenarioId", { integer: true, min: 1 }, false);
  const from = v.date("from", false);
  const to = v.date("to", false);
  v.done();
  return { kind: kind!, customerId, contactId, scenarioId, from, to };
};
