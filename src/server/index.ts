import { config } from "./config.js";
import { createApp } from "./app.js";
import { db } from "../data-sources/index.js";

const main = async () => {
  await db.ping();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Mi Tierrita API escuchando en http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`Documentación OpenAPI en http://localhost:${config.port}/docs`);
  });

  const shutdown = (signal: string) => {
    console.log(`Recibida señal ${signal}, cerrando...`);
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
