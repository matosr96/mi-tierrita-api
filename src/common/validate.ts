import type { ZodType } from "zod";
import { ErrorCodes, domainError } from "./errors.js";

/**
 * Valida la forma de los datos de entrada (tipos, campos obligatorios, longitudes)
 * en la capa de rutas, antes de que lleguen a la lógica de negocio.
 * Un dato mal formado responde 400 con el detalle de campos inválidos.
 */
export const validate = <T>(schema: ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw domainError(ErrorCodes.VALIDATION, details);
};

/** Convierte un parámetro de ruta (:id) en entero positivo o responde 400. */
export const parseId = (raw: string | string[] | undefined): number => {
  const n = Array.isArray(raw) ? NaN : Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: "Debe ser un entero positivo" }]);
  }
  return n;
};
