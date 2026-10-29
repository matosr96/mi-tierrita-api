import { config } from "../../server/config";
import type { Screen } from "../../models/index";
import { aiFailure, requireAi, textOf } from "./client";
import { SCREEN_CONTEXT } from "./assistant";

/**
 * Autocompletado al escribir (brief de octubre de 2026, punto 8): un modelo rápido y liviano, distinto del principal,
 * propone cómo terminar la pregunta que la persona está escribiendo. No consulta datos ni herramientas: solo texto.
 */
export const MIN_PREFIX = 6;
const MAX_WORDS = 14;

const SYSTEM =
  "Usted completa la pregunta que una persona le está escribiendo a Tita, la asistente del sistema de la agropecuaria Mi Tierrita (inventario, lotes y vencimientos, ventas, clientes y cartera, proveedores, reportes, finanzas, chat del equipo, alarmas). " +
  "Responda SOLO con la continuación del texto, en español de Colombia, trato de usted, sin repetir lo ya escrito, sin comillas, sin explicaciones y sin saltos de línea. Máximo " +
  `${MAX_WORDS} palabras. Si el texto ya es una pregunta completa o no sabe cómo seguir, responda con una cadena vacía.`;

/** Normaliza la continuación: sin saltos, sin repetir el final del prefijo, con el espacio inicial correcto. */
export const joinCompletion = (prefix: string, raw: string): string => {
  let c = raw.replace(/\s+/g, " ").replace(/^["'«»]+|["'«»]+$/g, "").trim();
  if (c === "") return "";
  // Si el modelo repitió el texto escrito, se queda solo con lo nuevo.
  const p = prefix.trim().toLowerCase();
  if (c.toLowerCase().startsWith(p)) c = c.slice(p.length).trimStart();
  if (c === "") return "";
  const words = c.split(" ");
  if (words.length > MAX_WORDS) c = words.slice(0, MAX_WORDS).join(" ");
  const endsWithSpace = /\s$/.test(prefix);
  const prefixEndsWord = /[\p{L}\p{N}]$/u.test(prefix);
  const startsPunct = /^[,.;:?!)]/.test(c);
  return endsWithSpace || startsPunct || !prefixEndsWord ? c : ` ${c}`;
};

export const completeQuestion = async (text: string, screen?: Screen): Promise<string> => {
  if (text.trim().length < MIN_PREFIX) return "";
  try {
    const res = await requireAi().messages.create({
      model: config.ai.fastModel,
      max_tokens: 60,
      system: `${SYSTEM}${screen ? ` La persona está en la pantalla ${SCREEN_CONTEXT[screen]}.` : ""}`,
      messages: [{ role: "user", content: `Texto escrito hasta ahora:\n${text}` }],
    });
    return joinCompletion(text, textOf(res.content));
  } catch (err) {
    return aiFailure(err);
  }
};
