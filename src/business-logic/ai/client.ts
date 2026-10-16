import Anthropic from "@anthropic-ai/sdk";
import { ErrorCodes, domainError } from "../../common/index";
import { config } from "../../server/config";

let client: Anthropic | undefined;

/** ¿Hay clave de Anthropic configurada? Sin ella la IA queda apagada y la app oculta sus funciones. */
export const aiEnabled = (): boolean => config.ai.apiKey.trim() !== "";

/** Cliente de Claude (uno por proceso). Lanza 660 si la IA no está configurada. */
export const requireAi = (): Anthropic => {
  if (!aiEnabled()) throw domainError(ErrorCodes.AI_UNAVAILABLE);
  client ??= new Anthropic({ apiKey: config.ai.apiKey, maxRetries: 2, timeout: 60_000 });
  return client;
};

/** Convierte un fallo del proveedor en 661 sin filtrar el detalle al cliente (queda en el log del servidor). */
export const aiFailure = (err: unknown): never => {
  console.error("Fallo del proveedor de IA:", err instanceof Error ? err.message : err);
  throw domainError(ErrorCodes.AI_FAILED);
};

/**
 * Margen de salida: los modelos razonan antes de responder y ese razonamiento cuenta dentro de max_tokens. Con un
 * límite justo (unos cientos) se gasta todo pensando y la respuesta llega vacía; el largo real lo limita el prompt.
 */
export const OUTPUT_BUDGET = { short: 4000, long: 8000 } as const;

/** Texto de la respuesta (concatena los bloques de texto). */
export const textOf = (content: Anthropic.ContentBlock[]): string =>
  content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
