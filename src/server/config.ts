import "dotenv/config";

/**
 * Configuración por entorno (documento 08, sección 4). Todo valor sensible se lee de
 * variables de entorno; el proceso no arranca si falta alguna obligatoria.
 */
const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  }
  return value;
};

const optional = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value;
};

/**
 * Modo TLS de la conexión a PostgreSQL.
 *   disable → sin TLS; es el caso de la base en docker compose.
 *   require → TLS sin verificar el certificado del servidor. Es lo que aceptan los
 *             Postgres gestionados que firman con su propia CA (Seenode, Render).
 *   verify  → TLS verificando el certificado contra las CA del sistema.
 */
const sslOption = (mode: string): boolean | { rejectUnauthorized: boolean } => {
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  if (mode === "verify") return true;
  throw new Error(`DB_SSL debe ser disable, require o verify (recibido: ${mode})`);
};

/**
 * Conexión a PostgreSQL. Los proveedores gestionados entregan una sola cadena
 * DATABASE_URL; en local se usan las variables sueltas del docker compose.
 */
const databaseConfig = () => {
  const url = process.env["DATABASE_URL"];
  if (url !== undefined && url.trim() !== "") {
    return { connectionString: url.trim(), ssl: sslOption(optional("DB_SSL", "require")) };
  }
  return {
    host: required("DB_HOST"),
    port: Number(optional("DB_PORT", "5432")),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    ssl: sslOption(optional("DB_SSL", "disable")),
  };
};

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}

export const config = {
  env: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "4300")),
  apiPrefix: "/api/v1",
  db: databaseConfig(),
  jwt: {
    secret: jwtSecret,
    expiresIn: optional("JWT_EXPIRES_IN", "8h"),
  },
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ""),
  bcryptRounds: 10,
} as const;
