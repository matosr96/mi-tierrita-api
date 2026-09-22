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

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}

export const config = {
  env: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "4300")),
  apiPrefix: "/api/v1",
  db: {
    host: required("DB_HOST"),
    port: Number(optional("DB_PORT", "5432")),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },
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
