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
  CONTACT_MESSAGE_NOT_FOUND: "608",
  CHAT_MESSAGE_NOT_FOUND: "609",

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

  AI_UNAVAILABLE: "660",
  AI_FAILED: "661",
  AI_TASK_NOT_FOUND: "662",
  AI_CONVERSATION_NOT_FOUND: "663",

  ALARM_NOT_FOUND: "670",
  ALARM_SCHEDULE_INVALID: "671",
  ALARM_LIMIT_REACHED: "672",
  PUSH_DISABLED: "673",
  PUSH_SUBSCRIPTION_NOT_FOUND: "674",

  REPORT_EXPORT_NOT_FOUND: "680",

  COMMENT_NOT_FOUND: "685",
  COMMENT_REPLY_MISMATCH: "686",
  COMMENT_NOT_OWNER: "687",
  RECORD_NOT_FOUND: "688",

  LIBRARY_ITEM_NOT_FOUND: "690",
  AVATAR_NOT_FOUND: "691",

  // Pedidos (0014)
  ORDER_NOT_FOUND: "700",
  ORDER_NOT_EDITABLE: "701",
  ORDER_RECEIPT_EXCEEDS: "702",
  ORDER_CLOSED: "703",
  ORDER_SALE_MISMATCH: "704",

  // Nómina (0015)
  PAYROLL_EMPLOYEE_NOT_FOUND: "705",
  PAYROLL_PERIOD_NOT_FOUND: "706",
  PAYROLL_PERIOD_NOT_EDITABLE: "707",
  PAYROLL_PERIOD_DUPLICATE: "708",
  PAYROLL_NO_ACTIVE_EMPLOYEES: "709",

  // Conteos de inventario (0016)
  STOCK_COUNT_NOT_FOUND: "710",
  STOCK_COUNT_TRANSITION_INVALID: "711",
  STOCK_COUNT_LINES_PENDING: "712",
  STOCK_COUNT_EXPIRY_REQUIRED: "713",
  STOCK_COUNT_SHORTAGE_EXCEEDS_STOCK: "714",

  // Proyectos del simulador (0017)
  FINANCIAL_PROJECT_NOT_FOUND: "715",
  FINANCIAL_PROJECT_NOT_OWNER: "716",
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
  "608": 404,
  "609": 404,
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
  "660": 503,
  "661": 502,
  "662": 404,
  "663": 404,
  "670": 404,
  "671": 422,
  "672": 409,
  "673": 503,
  "674": 404,
  "680": 404,
  "685": 404,
  "686": 409,
  "687": 403,
  "688": 404,
  "690": 404,
  "691": 404,
  "700": 404,
  "701": 409,
  "702": 409,
  "703": 409,
  "704": 409,
  "705": 404,
  "706": 404,
  "707": 409,
  "708": 409,
  "709": 422,
  "710": 404,
  "711": 409,
  "712": 422,
  "713": 400,
  "714": 409,
  "715": 404,
  "716": 403,
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
