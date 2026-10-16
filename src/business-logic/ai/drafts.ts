import { ErrorCodes, addDaysIso, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { config } from "../../server/config";
import { Roles, type Role } from "../../security/index";
import type { DraftKind, DraftRequest } from "../../models/index";
import { getCustomerBalance } from "../customers/index";
import { listSales } from "../sales/index";
import { salesReport } from "../reports/index";
import { getScenario } from "../financial/index";
import { OUTPUT_BUDGET, aiFailure, requireAi, textOf } from "./client";

export type Draft = { kind: DraftKind; text: string; phone: string | null };

/** Roles de cada borrador: los mismos que pueden ver los datos que usa. */
export const DRAFT_ROLES: Record<DraftKind, readonly Role[]> = {
  collection_message: [Roles.ADMIN, Roles.SALES],
  contact_reply: [Roles.ADMIN],
  report_summary: [Roles.ADMIN, Roles.SALES],
  scenario_explain: [Roles.ADMIN],
};

const STYLE =
  "Escribes como Tita, la asistente de Mi Tierrita: cercana y directa, sin relleno. Español de Colombia, trato de usted. Usa solo los datos dados; no inventes cifras, fechas, abonos, precios ni promesas. Pesos como $ 12.300. " +
  "Devuelve solo el texto final listo para usar: sin comentarios para quien lo envía, sin comillas ni asteriscos.";

const write = async (system: string, data: unknown): Promise<string> => {
  try {
    const res = await requireAi().messages.create({
      model: config.ai.fastModel,
      max_tokens: OUTPUT_BUDGET.short,
      system: `${system}\n${STYLE}`,
      messages: [{ role: "user", content: `Datos (JSON):\n${JSON.stringify(data)}` }],
    });
    const text = textOf(res.content);
    if (text === "") throw new Error(`respuesta sin texto (stop_reason ${res.stop_reason})`);
    return text;
  } catch (err) {
    return aiFailure(err);
  }
};

const collectionMessage = async (customerId: number): Promise<Draft> => {
  const balance = await getCustomerBalance(customerId);
  if (balance.balance <= 0) throw domainError(ErrorCodes.VALIDATION, [{ path: "customerId", message: "El cliente no tiene saldo pendiente" }]);
  const { rows } = await db.query<{ phone: string | null }>(`SELECT phone FROM customers WHERE id = $1`, [customerId]);
  const recent = await listSales({ page: 1, limit: 5, offset: 0 }, { customerId });
  const text = await write(
    "Redacta un mensaje de WhatsApp de la agropecuaria Mi Tierrita para un cliente con saldo pendiente. Cordial, respetuoso y corto (máximo 70 palabras): saludo con su nombre, el saldo, una invitación a abonar en la tienda y agradecimiento. Sin amenazas ni recargos. Si la cartera está vencida, menciónalo con tacto.",
    {
      cliente: balance.name,
      saldo: balance.balance,
      cupo: balance.creditLimit,
      carteraVencida: balance.overdue,
      ultimoAbono: balance.lastPaymentAt,
      ultimaCompraACredito: balance.lastCreditSaleAt,
      comprasRecientes: recent.items.filter((s) => s.paymentType === "CREDIT" && s.status === "COMPLETED").map((s) => ({ factura: s.invoiceNumber, fecha: s.createdAt.slice(0, 10), total: s.total })),
    },
  );
  return { kind: "collection_message", text, phone: rows[0]?.phone ?? null };
};

const contactReply = async (contactId: number): Promise<Draft> => {
  const { rows } = await db.query<{ name: string; phone: string | null; topic: string | null; body: string }>(`SELECT name, phone, topic, body FROM contact_messages WHERE id = $1`, [contactId]);
  const msg = rows[0];
  if (!msg) throw domainError(ErrorCodes.CONTACT_MESSAGE_NOT_FOUND);
  // Productos que se parecen a lo que pide, con precio y disponibilidad reales
  const words = msg.body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  const { rows: products } = await db.query<{ name: string; salePrice: number; available: number }>(
    `SELECT p.name, p.sale_price AS "salePrice",
            (SELECT COALESCE(sum(b.quantity_remaining), 0)::int FROM product_batches b WHERE b.product_id = p.id AND b.quantity_remaining > 0 AND b.expires_at >= CURRENT_DATE) AS available
     FROM products p
     WHERE p.active AND EXISTS (SELECT 1 FROM unnest($1::text[]) w WHERE translate(lower(p.name), 'áéíóú', 'aeiou') LIKE '%' || w || '%')
     LIMIT 8`,
    [words.length > 0 ? words : ["__nada__"]],
  );
  const text = await write(
    "Redacta la respuesta de la agropecuaria Mi Tierrita a un mensaje que llegó por el formulario del sitio web (para enviar por WhatsApp). Máximo 90 palabras. Responde a lo que pide usando los productos encontrados (precio y si hay existencias). Si no hay coincidencias, ofrece revisar y confirmar. No prometas entregas, descuentos ni fechas.",
    { cliente: msg.name, tema: msg.topic, mensaje: msg.body, productosEncontrados: products },
  );
  return { kind: "contact_reply", text, phone: msg.phone };
};

const reportSummary = async (from: string, to: string): Promise<Draft> => {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(days - 1));
  const [current, previous, byProduct] = await Promise.all([salesReport(from, to, "day"), salesReport(prevFrom, prevTo, "day"), salesReport(from, to, "product")]);
  const text = await write(
    "Escribe el resumen ejecutivo de un reporte de ventas: 3 o 4 frases, máximo 90 palabras. Compara con el período anterior de igual duración (si el anterior es 0, no calcules porcentaje). Menciona el producto que más vendió y la mezcla contado/crédito. Termina con una observación útil para decidir.",
    {
      periodo: { desde: from, hasta: to, ventas: current.salesCount, unidades: current.units, total: current.total, contado: current.cashTotal, credito: current.creditTotal, ticketPromedio: current.averageTicket },
      periodoAnterior: { desde: prevFrom, hasta: prevTo, ventas: previous.salesCount, total: previous.total },
      productosQueMasVendieron: byProduct.rows.slice(0, 5),
      mejorDia: [...current.rows].sort((a, b) => b.total - a.total)[0] ?? null,
    },
  );
  return { kind: "report_summary", text, phone: null };
};

const scenarioExplain = async (scenarioId: number): Promise<Draft> => {
  const s = await getScenario(scenarioId);
  const text = await write(
    "Explica a la dueña de una agropecuaria, en lenguaje sencillo y sin jerga, si le conviene este escenario de ampliación con crédito y por qué. Máximo 130 palabras, en 2 párrafos: (1) el veredicto con VPN y TIR traducidos a palabras (VPN > 0 crea valor; TIR frente a la tasa exigida); (2) qué tendría que pasar para que cambie (cuota mensual, cobertura de la cuota con las ventas, recuperación). No recomiendes tomar o no el crédito como asesoría financiera: describe lo que muestran las cifras.",
    { nombre: s.name, supuestos: s.assumptions, resultados: s.results },
  );
  return { kind: "scenario_explain", text, phone: null };
};

/** Redacta un borrador de texto con datos reales. El rol ya se verificó contra DRAFT_ROLES en el controlador. */
export const createDraft = async (req: DraftRequest): Promise<Draft> => {
  switch (req.kind) {
    case "collection_message":
      if (req.customerId === undefined) throw domainError(ErrorCodes.VALIDATION, [{ path: "customerId", message: "Campo obligatorio" }]);
      return collectionMessage(req.customerId);
    case "contact_reply":
      if (req.contactId === undefined) throw domainError(ErrorCodes.VALIDATION, [{ path: "contactId", message: "Campo obligatorio" }]);
      return contactReply(req.contactId);
    case "report_summary":
      if (req.from === undefined || req.to === undefined || req.from > req.to) throw domainError(ErrorCodes.VALIDATION, [{ path: "from", message: "Rango de fechas inválido" }]);
      return reportSummary(req.from, req.to);
    case "scenario_explain":
      if (req.scenarioId === undefined) throw domainError(ErrorCodes.VALIDATION, [{ path: "scenarioId", message: "Campo obligatorio" }]);
      return scenarioExplain(req.scenarioId);
  }
};
