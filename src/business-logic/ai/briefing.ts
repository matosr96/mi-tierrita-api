import { todayIso } from "../../common/index";
import { config } from "../../server/config";
import type { Role } from "../../security/index";
import { OUTPUT_BUDGET, aiEnabled, requireAi, textOf } from "./client";
import { computeInsights, type Insight } from "./insights";

export type Briefing = { text: string | null; generatedAt: string; insights: Insight[] };

/** El texto se reutiliza una hora por rol: las recomendaciones son las mismas para todas las personas del rol. */
const cache = new Map<string, { at: number; text: string }>();
const TTL_MS = 60 * 60 * 1000;

const FOCUS: Record<Role, string> = {
  ADMIN: "el negocio completo: qué reponer, qué rotar o rebajar antes de que venza, a quién cobrar y el capital quieto",
  SALES: "la cartera: a quién cobrar primero y por qué",
  WAREHOUSE: "la bodega: qué reponer, qué sacar al frente o avisar para rebajar antes de que venza y qué no rota",
};

/**
 * Recomendaciones del día (siempre, sin IA) y un párrafo que las prioriza (con IA, si está configurada).
 * Si la IA falla, se devuelven las recomendaciones sin texto: el Inicio nunca se queda vacío por la IA.
 */
export const getBriefing = async (role: Role): Promise<Briefing> => {
  const insights = await computeInsights(role);
  const generatedAt = new Date().toISOString();
  if (!aiEnabled() || insights.length === 0) return { text: null, generatedAt, insights };

  const key = `${role}:${todayIso()}:${JSON.stringify(insights)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { text: hit.text, generatedAt, insights };

  try {
    const res = await requireAi().messages.create({
      model: config.ai.fastModel,
      max_tokens: OUTPUT_BUDGET.short,
      system:
        "Escribe el resumen del día de una agropecuaria colombiana. Lo lee el equipo de la tienda (no los clientes): háblale al equipo, nunca al cliente. Español de Colombia, trato de usted, máximo 3 frases y 70 palabras. " +
        "Prioriza lo de mayor impacto en dinero o en riesgo de pérdida y di qué hacer primero. Usa solo las cifras dadas (pesos como $ 12.300); no inventes nada ni repitas la lista completa. " +
        "Habla solo de lo que recibiste: no menciones datos que faltan, ni códigos SKU, ni la palabra JSON, ni teléfonos. No calcules ni deduzcas cifras o días que no vengan en los datos (un campo en null significa que no hay dato). Si hay una sola recomendación, basta con una o dos frases. Texto plano, sin markdown.",
      messages: [{ role: "user", content: `Enfoque: ${FOCUS[role]}.\nRecomendaciones calculadas (JSON):\n${JSON.stringify(insights)}` }],
    });
    const text = textOf(res.content);
    if (text === "") return { text: null, generatedAt, insights };
    cache.set(key, { at: Date.now(), text });
    return { text, generatedAt, insights };
  } catch (err) {
    console.error("No se pudo redactar el resumen del día:", err instanceof Error ? err.message : err);
    return { text: null, generatedAt, insights };
  }
};
