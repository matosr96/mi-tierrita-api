import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import {
  deliveryStatus,
  extractLinks,
  extractMentions,
  parseChatMediaKind,
  parseCreateChatMessage,
  parseEditChatMessage,
  parseIdList,
  parseMarkChatRead,
  parseSearchDay,
  parseUploadChatAttachment,
} from "../src/models/chat";
import { canQuote, canSee, peerFor, sameConversation } from "../src/business-logic/chat/shared";
import { canPin } from "../src/business-logic/chat/pin-message";
import { canDelete } from "../src/business-logic/chat/delete-message";
import { canMarkPlayed } from "../src/business-logic/chat/mark-played";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("un mensaje puede ir sin texto si lleva adjuntos, pero no vacío del todo", () => {
  assert.deepEqual(parseCreateChatMessage({ attachmentIds: [4, 5] }).attachmentIds, [4, 5]);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "" })), ["body"]);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "x", attachmentIds: [1, 1] })), ["attachmentIds"]);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "x", attachmentIds: [1, 2, 3, 4, 5, 6] })), ["attachmentIds"]);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "x", attachmentIds: ["1"] })), ["attachmentIds"]);
});

test("clientId debe ser un UUID y se normaliza en minúsculas (evita duplicados en reintentos)", () => {
  const id = "3F2504E0-4F89-11D3-9A0C-0305E82C3301";
  assert.equal(parseCreateChatMessage({ body: "Hola", clientId: id }).clientId, id.toLowerCase());
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "Hola", clientId: "abc" })), ["clientId"]);
});

test("cita, hilo y destinatario son ids positivos", () => {
  const ok = parseCreateChatMessage({ body: "Sí", replyToId: 8, threadRootId: 7 });
  assert.equal(ok.replyToId, 8);
  assert.equal(ok.threadRootId, 7);
  assert.deepEqual(paths400(() => parseCreateChatMessage({ body: "Sí", replyToId: 0, threadRootId: -1 })), ["replyToId", "threadRootId"]);
});

test("extractMentions reconoce @usuario y @todos sin confundir correos", () => {
  assert.deepEqual(extractMentions("Hola @Karina y @alexa.r, revisen"), { usernames: ["karina", "alexa.r"], everyone: false });
  assert.deepEqual(extractMentions("@todos llegó el pedido"), { usernames: [], everyone: true });
  assert.deepEqual(extractMentions("escriba a ventas@finca.co"), { usernames: [], everyone: false });
  assert.deepEqual(extractMentions("(@edgar) ¿@karina?"), { usernames: ["edgar", "karina"], everyone: false });
});

test("estado de entrega: visto solo cuando todos leyeron; entregado cuando a todos les llegó", () => {
  assert.equal(deliveryStatus(3, 3, 3), "read");
  assert.equal(deliveryStatus(3, 3, 2), "delivered");
  assert.equal(deliveryStatus(3, 2, 2), "sent");
  assert.equal(deliveryStatus(0, 0, 0), "sent");
});

test("nota de voz: reproducido solo cuando todos la escucharon, y nunca en mensajes sin audio", () => {
  assert.equal(deliveryStatus(3, 3, 3, 3, true), "played");
  assert.equal(deliveryStatus(3, 3, 3, 2, true), "read");
  assert.equal(deliveryStatus(1, 1, 1, 1, true), "played");
  assert.equal(deliveryStatus(3, 3, 3, 3, false), "read", "sin audio no hay estado reproducido");
  assert.equal(deliveryStatus(0, 0, 0, 0, true), "sent");
});

test("marcar como reproducido: solo un mensaje ajeno, vigente y con nota de voz", () => {
  const audio = [{ mime: "audio/webm" }];
  assert.ok(canMarkPlayed(2, { userId: 1, deletedAt: null }, audio));
  assert.ok(!canMarkPlayed(1, { userId: 1, deletedAt: null }, audio), "propio");
  assert.ok(!canMarkPlayed(2, { userId: 1, deletedAt: null }, [{ mime: "image/png" }]), "sin audio");
  assert.ok(!canMarkPlayed(2, { userId: 1, deletedAt: null }, []), "sin adjuntos");
  assert.ok(!canMarkPlayed(2, { userId: 1, deletedAt: new Date() }, audio), "eliminado");
});

test("privacidad: un privado solo lo ven sus dos participantes", () => {
  const dm = { userId: 1, recipientId: 2 };
  assert.ok(canSee(1, dm) && canSee(2, dm));
  assert.ok(!canSee(3, dm));
  assert.ok(canSee(3, { userId: 1, recipientId: null }));
  assert.equal(peerFor(2, dm), 1);
  assert.equal(peerFor(2, { userId: 1, recipientId: null }), null);
  assert.ok(sameConversation({ userId: 1, recipientId: 2 }, { userId: 2, recipientId: 1 }));
  assert.ok(!sameConversation({ userId: 1, recipientId: 2 }, { userId: 1, recipientId: 3 }));
  assert.ok(!sameConversation({ userId: 1, recipientId: null }, { userId: 1, recipientId: 2 }));
});

test("responder por privado: solo al autor de un mensaje del canal general; nunca citar privados ajenos", () => {
  const general = { userId: 5, recipientId: null };
  assert.ok(canQuote(1, general, { userId: 1, recipientId: 5 }), "privado al autor");
  assert.ok(!canQuote(1, general, { userId: 1, recipientId: 6 }), "privado a otra persona");
  assert.ok(canQuote(1, general, { userId: 1, recipientId: null }), "cita en el mismo canal");
  assert.ok(!canQuote(1, { userId: 5, recipientId: 6 }, { userId: 1, recipientId: 5 }), "privado ajeno");
  assert.ok(!canQuote(1, { userId: 1, recipientId: 5 }, { userId: 1, recipientId: null }), "un privado no se cita en el canal");
});

test("fijar: en el canal general solo administración; en un privado, cualquiera de los dos", () => {
  assert.ok(canPin({ userId: 1, role: "ADMIN" }, { recipientId: null }));
  assert.ok(!canPin({ userId: 2, role: "SALES" }, { recipientId: null }));
  assert.ok(!canPin({ userId: 3, role: "WAREHOUSE" }, { recipientId: null }));
  assert.ok(canPin({ userId: 3, role: "WAREHOUSE" }, { recipientId: 2 }));
});

test("adjuntos: solo tipos permitidos, con nombre limpio y tamaño acotado", () => {
  const ok = parseUploadChatAttachment({ body: Buffer.from("hola"), contentType: "text/plain; charset=utf-8", fileName: encodeURIComponent("../notas de bodega.txt") });
  assert.equal(ok.mime, "text/plain");
  assert.equal(ok.name, ".._notas de bodega.txt");
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.from("<h1>"), contentType: "text/html", fileName: "a.html" })), ["file"]);
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.alloc(0), contentType: "image/png", fileName: "" })), ["name", "file"]);
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.alloc(10 * 1024 * 1024 + 1), contentType: "application/pdf", fileName: "x.pdf" })), ["file"]);
});

test("adjuntos de audio: se aceptan los tipos que graba el navegador y la duración en X-Duration-Ms", () => {
  const voice = parseUploadChatAttachment({ body: Buffer.from("opus"), contentType: "audio/webm;codecs=opus", fileName: "Nota%20de%20voz.webm", durationMs: "4200" });
  assert.equal(voice.mime, "audio/webm");
  assert.equal(voice.name, "Nota de voz.webm");
  assert.equal(voice.durationMs, 4200);
  for (const mime of ["audio/ogg", "audio/mp4", "audio/mpeg"]) assert.equal(parseUploadChatAttachment({ body: Buffer.from("x"), contentType: mime, fileName: "a" }).mime, mime);
  assert.equal(parseUploadChatAttachment({ body: Buffer.from("x"), contentType: "audio/mp4", fileName: "a.m4a" }).durationMs, null, "la duración es opcional");
  assert.equal(parseUploadChatAttachment({ body: Buffer.from("x"), contentType: "application/pdf", fileName: "a.pdf", durationMs: "4200" }).durationMs, null, "solo cuenta en audio");
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.from("x"), contentType: "audio/webm", fileName: "a.webm", durationMs: "abc" })), ["durationMs"]);
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.from("x"), contentType: "audio/webm", fileName: "a.webm", durationMs: "0" })), ["durationMs"]);
  assert.deepEqual(paths400(() => parseUploadChatAttachment({ body: Buffer.from("x"), contentType: "audio/wav", fileName: "a.wav" })), ["file"], "WAV no está en la lista");
});

test("búsqueda por día: fecha YYYY-MM-DD válida u omitida", () => {
  assert.equal(parseSearchDay("2026-10-29"), "2026-10-29");
  assert.equal(parseSearchDay(undefined), undefined);
  assert.equal(parseSearchDay(""), undefined);
  assert.deepEqual(paths400(() => parseSearchDay("29/10/2026")), ["day"]);
  assert.deepEqual(paths400(() => parseSearchDay("2026-13-40")), ["day"]);
  assert.deepEqual(paths400(() => parseSearchDay(["2026-10-29"])), ["day"]);
});

test("extractLinks saca las direcciones del texto sin la puntuación que las cierra y sin repetir", () => {
  assert.deepEqual(extractLinks("Miren https://mitierrita.co/catalogo, y también http://ejemplo.com/a?b=1&c=2."), ["https://mitierrita.co/catalogo", "http://ejemplo.com/a?b=1&c=2"]);
  assert.deepEqual(extractLinks("(ver https://es.wikipedia.org/wiki/Huevo_(alimento))"), ["https://es.wikipedia.org/wiki/Huevo_(alimento)"]);
  assert.deepEqual(extractLinks("https://a.co/x https://a.co/x HTTPS://A.co/y"), ["https://a.co/x", "HTTPS://A.co/y"]);
  assert.deepEqual(extractLinks("sin enlaces: ventas@finca.co y www.sinprotocolo.com"), []);
  assert.deepEqual(extractLinks(""), []);
});

test("contenido de la conversación: solo fotos, archivos, audios o enlaces", () => {
  assert.equal(parseChatMediaKind("image"), "image");
  assert.equal(parseChatMediaKind("link"), "link");
  assert.deepEqual(paths400(() => parseChatMediaKind("video")), ["kind"]);
  assert.deepEqual(paths400(() => parseChatMediaKind(undefined)), ["kind"]);
});

test("marcar como leído y listas de ids", () => {
  assert.deepEqual(parseMarkChatRead({ with: 2, upTo: 40 }), { peerId: 2, threadRootId: null, upTo: 40, includeThreads: false });
  assert.deepEqual(parseMarkChatRead({ includeThreads: true }), { peerId: null, threadRootId: null, upTo: null, includeThreads: true });
  assert.deepEqual(parseIdList("3, 1,3"), [3, 1]);
  assert.deepEqual(paths400(() => parseIdList("1,x")), ["ids"]);
  assert.deepEqual(paths400(() => parseIdList(undefined)), ["ids"]);
});

test("editar exige el texto (puede quedar vacío; la lógica decide si hay adjuntos)", () => {
  assert.deepEqual(parseEditChatMessage({ body: "  Corregido  " }), { body: "Corregido" });
  assert.deepEqual(parseEditChatMessage({ body: "" }), { body: "" });
  assert.deepEqual(paths400(() => parseEditChatMessage({})), ["body"]);
  assert.deepEqual(paths400(() => parseEditChatMessage({ body: "x".repeat(1001) })), ["body"]);
});

test("eliminar: el autor siempre; la administración también en el canal general, nunca en privados ajenos", () => {
  assert.ok(canDelete({ userId: 2, role: "SALES" }, { userId: 2, recipientId: null }));
  assert.ok(!canDelete({ userId: 2, role: "SALES" }, { userId: 3, recipientId: null }));
  assert.ok(canDelete({ userId: 1, role: "ADMIN" }, { userId: 3, recipientId: null }));
  assert.ok(!canDelete({ userId: 1, role: "ADMIN" }, { userId: 3, recipientId: 1 }));
  assert.ok(canDelete({ userId: 3, role: "WAREHOUSE" }, { userId: 3, recipientId: 1 }));
});
