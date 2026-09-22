import { ErrorCodes, domainError } from "./errors";

/**
 * Validación de la forma de los datos de entrada (tipos, campos obligatorios, longitudes)
 * en la capa de presentación, antes de que lleguen a la lógica de negocio. Sin librerías:
 * cada DTO de entrada define su función `parseX(body)` con estos ayudantes.
 * Todos los problemas se acumulan y se responden juntos con 400 y `details`.
 */
export type ValidationIssue = { path: string; message: string };

type StringRule = { min?: number; max?: number; pattern?: RegExp; patternMessage?: string; trim?: boolean };
type NumberRule = { min?: number; max?: number; integer?: boolean; decimals?: number };
type ArrayRule = { min?: number; max?: number };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export type Validator = {
  string: (field: string, rule?: StringRule, required?: boolean) => string | undefined;
  number: (field: string, rule?: NumberRule, required?: boolean) => number | undefined;
  boolean: (field: string, required?: boolean) => boolean | undefined;
  oneOf: <T extends string>(field: string, values: readonly T[], required?: boolean) => T | undefined;
  date: (field: string, required?: boolean) => string | undefined;
  array: <T>(field: string, rule: ArrayRule, each: (item: Validator) => T | undefined, required?: boolean) => T[] | undefined;
  has: (field: string) => boolean;
  isNull: (field: string) => boolean;
  custom: (field: string, message: string) => void;
  issues: () => ValidationIssue[];
  done: () => void;
};

/** Crea un validador sobre un objeto de entrada. `path` prefija los campos (para arreglos anidados). */
export const createValidator = (input: unknown, path = ""): Validator => {
  const issues: ValidationIssue[] = [];
  const data: Record<string, unknown> = isPlainObject(input) ? input : {};
  if (!isPlainObject(input)) issues.push({ path: path || "body", message: "Se esperaba un objeto JSON" });

  const at = (field: string): string => (path === "" ? field : `${path}.${field}`);
  const fail = (field: string, message: string): undefined => {
    issues.push({ path: at(field), message });
    return undefined;
  };
  const missing = (field: string, required: boolean): boolean => {
    const value = data[field];
    if (value === undefined || value === null) {
      if (required) fail(field, "Campo obligatorio");
      return true;
    }
    return false;
  };

  const string = (field: string, rule: StringRule = {}, required = true): string | undefined => {
    if (missing(field, required)) return undefined;
    const raw = data[field];
    if (typeof raw !== "string") return fail(field, "Debe ser texto");
    const value = rule.trim === false ? raw : raw.trim();
    if (rule.min !== undefined && value.length < rule.min) return fail(field, `Mínimo ${rule.min} caracteres`);
    if (rule.max !== undefined && value.length > rule.max) return fail(field, `Máximo ${rule.max} caracteres`);
    if (rule.pattern !== undefined && !rule.pattern.test(value)) return fail(field, rule.patternMessage ?? "Formato inválido");
    return value;
  };

  const number = (field: string, rule: NumberRule = {}, required = true): number | undefined => {
    if (missing(field, required)) return undefined;
    const value = data[field];
    if (typeof value !== "number" || !Number.isFinite(value)) return fail(field, "Debe ser un número");
    if (rule.integer === true && !Number.isInteger(value)) return fail(field, "Debe ser un entero");
    if (rule.min !== undefined && value < rule.min) return fail(field, `Mínimo ${rule.min}`);
    if (rule.max !== undefined && value > rule.max) return fail(field, `Máximo ${rule.max}`);
    if (rule.decimals !== undefined && Math.round(value * 10 ** rule.decimals) / 10 ** rule.decimals !== value) {
      return fail(field, `Máximo ${rule.decimals} decimales`);
    }
    return value;
  };

  const boolean = (field: string, required = true): boolean | undefined => {
    if (missing(field, required)) return undefined;
    const value = data[field];
    if (typeof value !== "boolean") return fail(field, "Debe ser true o false");
    return value;
  };

  const oneOf = <T extends string>(field: string, values: readonly T[], required = true): T | undefined => {
    if (missing(field, required)) return undefined;
    const value = data[field];
    if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
      return fail(field, `Debe ser uno de: ${values.join(", ")}`);
    }
    return value as T;
  };

  const date = (field: string, required = true): string | undefined => {
    if (missing(field, required)) return undefined;
    const value = data[field];
    if (!isIsoDate(value)) return fail(field, "Formato esperado YYYY-MM-DD");
    return value;
  };

  /** Valida cada elemento con `each(validadorHijo, índice)`; devuelve los elementos válidos. */
  const array = <T>(field: string, rule: ArrayRule, each: (item: Validator) => T | undefined, required = true): T[] | undefined => {
    if (missing(field, required)) return undefined;
    const value = data[field];
    if (!Array.isArray(value)) return fail(field, "Debe ser una lista");
    if (rule.min !== undefined && value.length < rule.min) return fail(field, `Mínimo ${rule.min} elementos`);
    if (rule.max !== undefined && value.length > rule.max) return fail(field, `Máximo ${rule.max} elementos`);
    const items: T[] = [];
    value.forEach((item, index) => {
      const child = createValidator(item, `${at(field)}[${index}]`);
      const parsed = each(child);
      issues.push(...child.issues());
      if (parsed !== undefined) items.push(parsed);
    });
    return items;
  };

  /** true si el campo vino en el body (aunque sea null): distingue "borrar" de "no tocar". */
  const has = (field: string): boolean => field in data;
  const isNull = (field: string): boolean => data[field] === null;

  const issuesList = (): ValidationIssue[] => issues;

  /** Lanza 400 con el detalle si hubo problemas. */
  const done = (): void => {
    if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  };

  const custom = (field: string, message: string): void => {
    fail(field, message);
  };

  return { string, number, boolean, oneOf, date, array, has, isNull, custom, issues: issuesList, done };
};

/** Convierte un parámetro de ruta (:id) en entero positivo o responde 400. */
export const parseId = (raw: string | string[] | undefined, name = "id"): number => {
  const n = Array.isArray(raw) ? NaN : Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: name, message: "Debe ser un entero positivo" }]);
  }
  return n;
};

/** Lee un entero positivo opcional de la query (?customerId=3). Un valor inválido se ignora. */
export const queryId = (raw: unknown): number | undefined => {
  if (typeof raw !== "string") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Lee un booleano opcional de la query (?active=true). */
export const queryBoolean = (raw: unknown): boolean | undefined =>
  raw === "true" ? true : raw === "false" ? false : undefined;

/** Lee un texto opcional de la query, recortado y acotado. */
export const queryString = (raw: unknown, max = 100): string | undefined =>
  typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, max) : undefined;
