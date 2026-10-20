import type { RequestHandler } from "express";
import { isSessionAlive, requireAuth } from "../../security/index";
import { touchPresence } from "../../business-logic/users/touch-presence";
import { markChatDelivered, subscribeChat, type ChatClientEvent } from "../../business-logic/chat/index";

/** Cada 25 s: comentario para que proxies y balanceadores no corten la conexión, presencia y vigencia de la sesión. */
const HEARTBEAT_MS = 25_000;

/**
 * GET /api/v1/chat/stream — autenticado. Avisos en vivo del chat con Server-Sent Events (`text/event-stream`). Cada
 * evento es `data: <json>` con `type` message | update | team; al abrir llega `ready`. La conexión se cierra sola si
 * la sesión deja de ser válida (`bye`); la app reconecta y, al hacerlo, pide lo que se haya perdido.
 */
export const chatStreamController: RequestHandler = (req, res) => {
  const auth = requireAuth(req);
  const token = (req.headers.authorization ?? "").slice("Bearer ".length).trim();

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  req.socket.setKeepAlive(true);
  req.socket.setTimeout(0);

  let open = true;
  const write = (chunk: string) => {
    if (open) res.write(chunk);
  };
  // Un mensaje ajeno que sale por esta conexión ya llegó a la app: se marca entregado (agrupado si llegan varios).
  let deliverTimer: NodeJS.Timeout | undefined;
  const scheduleDelivered = () => {
    clearTimeout(deliverTimer);
    deliverTimer = setTimeout(() => void markChatDelivered(auth.userId).catch((err: unknown) => console.error("No se pudo marcar la entrega del chat:", err)), 300);
  };
  const send = (event: ChatClientEvent | { type: "ready" | "bye" }) => {
    write(`data: ${JSON.stringify(event)}\n\n`);
    if (open && event.type === "message" && event.authorId !== auth.userId) scheduleDelivered();
  };

  const close = () => {
    if (!open) return;
    open = false;
    clearInterval(timer);
    clearTimeout(deliverTimer);
    unsubscribe();
    res.end();
  };
  const unsubscribe = subscribeChat(auth.userId, send, () => {
    send({ type: "bye" });
    close();
  });
  const timer = setInterval(() => {
    write(`: ping\n\n`);
    void isSessionAlive(token).then((alive) => {
      if (!alive) {
        send({ type: "bye" });
        close();
        return;
      }
      void touchPresence(auth.userId).catch(() => undefined);
    });
  }, HEARTBEAT_MS);

  req.on("close", close);
  write(`retry: 3000\n\n`);
  send({ type: "ready" });
  // Tener la app abierta con la conexión en vivo cuenta como "entregado".
  void markChatDelivered(auth.userId).catch((err: unknown) => console.error("No se pudo marcar la entrega del chat:", err));
};
