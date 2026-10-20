import { config } from "./config";
import { createApp } from "./app";
import { db, stopListening } from "../data-sources/index";
import { closeChatStreams, startChatRealtime } from "../business-logic/chat/index";

const main = async () => {
  await db.ping();
  // Avisos en vivo del chat; si la escucha falla, el chat sigue funcionando y la app consulta periódicamente.
  await startChatRealtime().catch((err: unknown) => console.error("Avisos en vivo del chat no disponibles:", err));
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Mi Tierrita API escuchando en http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`Documentación OpenAPI en http://localhost:${config.port}/docs`);
  });

  const shutdown = (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando...`);
    closeChatStreams();
    void stopListening();
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

main().catch((err: unknown) => {
  console.error("La API no pudo arrancar:", err);
  process.exit(1);
});
