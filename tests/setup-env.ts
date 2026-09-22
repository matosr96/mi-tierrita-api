// Variables mínimas para que config.ts cargue en pruebas unitarias (sin base de datos).
process.env["JWT_SECRET"] ??= "secreto-de-pruebas-unitarias-de-al-menos-32-chars";
process.env["DB_HOST"] ??= "localhost";
process.env["DB_NAME"] ??= "test";
process.env["DB_USER"] ??= "test";
process.env["DB_PASSWORD"] ??= "test";
