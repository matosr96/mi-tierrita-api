/**
 * Códigos de error de dominio (RNF-06). Toda respuesta de error es {"message": "<código>"}.
 * El cliente traduce el código a un mensaje legible; el servidor nunca devuelve stack traces.
 */
export const ErrorCodes = {
  VALIDATION: "400",
  ROUTE_NOT_FOUND: "404",
  INTERNAL: "500",

  PRODUCT_NOT_FOUND: "601",
  CATEGORY_NOT_FOUND: "602",
  USER_NOT_FOUND: "603",
  CUSTOMER_NOT_FOUND: "604",
  SUPPLIER_NOT_FOUND: "605",
  SALE_NOT_FOUND: "606",
  SCENARIO_NOT_FOUND: "607",

  INVALID_CREDENTIALS: "610",
  TOKEN_INVALID: "611",
  USER_INACTIVE: "612",
  ROLE_INSUFFICIENT: "613",

  STOCK_INSUFFICIENT: "620",
  CREDIT_LIMIT_EXCEEDED: "621",
  SALE_ALREADY_VOIDED: "622",
  PAYMENT_EXCEEDS_BALANCE: "623",
  PRODUCT_INACTIVE: "625",
  CUSTOMER_INACTIVE: "626",

  DUPLICATE_RESOURCE: "630",
  CATEGORY_IN_USE: "631",

  TOO_MANY_ATTEMPTS: "640",

  INVALID_SCENARIO: "650",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Estado HTTP con el que se responde cada código de dominio. */
export const httpStatusByCode: Record<ErrorCode, number> = {
  "400": 400,
  "404": 404,
  "500": 500,
  "601": 404,
  "602": 404,
  "603": 404,
  "604": 404,
  "605": 404,
  "606": 404,
  "607": 404,
  "610": 401,
  "611": 401,
  "612": 401,
  "613": 403,
  "620": 409,
  "621": 409,
  "622": 409,
  "623": 409,
  "625": 409,
  "626": 409,
  "630": 409,
  "631": 409,
  "640": 429,
  "650": 422,
};

/**
 * Error de dominio: la lógica de negocio lanza `domainError(ErrorCodes.X)` y el
 * manejador de errores lo traduce a la respuesta HTTP. `details` es opcional y
 * solo se usa para errores de validación (lista de campos inválidos).
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.status = httpStatusByCode[code];
    this.details = details;
  }
}

export const domainError = (code: ErrorCode, details?: unknown): DomainError =>
  new DomainError(code, details);

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
