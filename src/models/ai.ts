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

/** Asistente de IA: la conversación viaja completa en cada pregunta (no se guarda en la base). */
export const MAX_TURNS = 20;

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
