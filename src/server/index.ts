import { config } from "./config";
import { createApp } from "./app";
import { db, stopListening } from "../data-sources/index";
import { closeChatStreams, startChatRealtime } from "../business-logic/chat/index";
import { startAlarmScheduler, stopAlarmScheduler } from "../business-logic/alarms/scheduler";
import { runSeed } from "../scripts/seed";

const main = async () => {
  await db.ping();
  // Datos de ejemplo (brief 2026, punto 39): solo con SEED_ON_START=true; el seed es idempotente y tarda segundos.
  if (config.seedOnStart) await runSeed();
  // Avisos en vivo del chat; si la escucha falla, el chat sigue funcionando y la app consulta periódicamente.
  await startChatRealtime().catch((err: unknown) => console.error("Avisos en vivo del chat no disponibles:", err));
  // Alarmas personalizadas y resumen diario de vencimientos: una vuelta por minuto (brief 2026, puntos 12 y 13).
  startAlarmScheduler();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Mi Tierrita API escuchando en http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`Documentación OpenAPI en http://localhost:${config.port}/docs`);
  });

  const shutdown = (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando...`);
    stopAlarmScheduler();
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
