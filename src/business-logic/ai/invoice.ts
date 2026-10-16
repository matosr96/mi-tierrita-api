import type Anthropic from "@anthropic-ai/sdk";
import { todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import { config } from "../../server/config";
import type { InvoiceImageInput } from "../../models/index";
import { OUTPUT_BUDGET, aiFailure, requireAi } from "./client";


type Candidate = { productId: number; name: string; sku: string; purchasePrice: number; score: number };

export type InvoiceLine = {
  description: string;
  quantity: number | null;
  unitCost: number | null;
  expiresAt: string | null;
  lot: string | null;
  /** Productos del catálogo que más se parecen, del más probable al menos; la persona elige. */
  candidates: Candidate[];
  warnings: string[];
};

export type InvoiceReading = {
  supplier: { name: string | null; taxId: string | null; match: { supplierId: number; name: string } | null };
  invoiceNumber: string | null;
  invoiceDate: string | null;
  lines: InvoiceLine[];
  notes: string | null;
};

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "registrar_lectura",
  description: "Devuelve lo que se lee en la factura o remisión del proveedor.",
  input_schema: {
    type: "object",
    properties: {
      proveedor: { type: ["string", "null"] },
      nit: { type: ["string", "null"] },
      numeroFactura: { type: ["string", "null"] },
      fecha: { type: ["string", "null"], description: "YYYY-MM-DD" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            descripcion: { type: "string" },
            cantidad: { type: ["number", "null"], description: "Unidades de venta (bultos, frascos, unidades)" },
            costoUnitario: { type: ["number", "null"], description: "Costo por unidad en pesos, sin IVA si está separado" },
            vencimiento: { type: ["string", "null"], description: "YYYY-MM-DD si aparece" },
            lote: { type: ["string", "null"] },
          },
          required: ["descripcion"],
        },
      },
      observaciones: { type: ["string", "null"], description: "Algo ilegible o dudoso que la persona deba revisar" },
    },
    required: ["items"],
  },
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** Parecido simple por palabras compartidas (más peso si coincide el SKU). */
const score = (desc: string, name: string, sku: string): number => {
  const a = new Set(normalize(desc));
  const b = normalize(name);
  if (b.length === 0) return 0;
  const shared = b.filter((w) => a.has(w)).length;
  const skuHit = normalize(sku).some((w) => a.has(w)) ? 0.5 : 0;
  return Math.round(((shared / b.length) * 0.8 + skuHit) * 100) / 100;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Lee la foto de una factura y la cruza con el catálogo y los proveedores. No registra nada. */
export const readInvoice = async (input: InvoiceImageInput): Promise<InvoiceReading> => {
  const ai = requireAi();
  let res: Anthropic.Message;
  try {
    res = await ai.messages.create({
      model: config.ai.model,
      max_tokens: OUTPUT_BUDGET.long,
      tools: [EXTRACT_TOOL],
      // Los modelos que razonan no aceptan forzar la herramienta: se pide en el texto y se verifica abajo.
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.image } },
            {
              type: "text",
              text:
                "Es una factura o remisión de un proveedor de una agropecuaria colombiana. Extrae cada producto con su cantidad, costo unitario en pesos y fecha de vencimiento si aparece. " +
                "No inventes: si un dato no se lee, déjalo en null y anótalo en observaciones. Los pesos colombianos usan punto para miles. " +
                "Responde únicamente llamando a la herramienta registrar_lectura.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    return aiFailure(err);
  }
  const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!call) return aiFailure(new Error(`la lectura no usó la herramienta (stop_reason ${res.stop_reason})`));
  const data = (call.input ?? {}) as Record<string, unknown>;

  const { rows: products } = await db.query<{ id: number; name: string; sku: string; purchasePrice: number }>(
    `SELECT id, name, sku, purchase_price AS "purchasePrice" FROM products WHERE active`,
  );
  const { rows: suppliers } = await db.query<{ id: number; name: string; taxId: string | null }>(`SELECT id, name, tax_id AS "taxId" FROM suppliers WHERE active`);

  const supplierName = str(data["proveedor"]);
  const taxId = str(data["nit"]);
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const supplierMatch =
    suppliers.find((s) => taxId !== null && s.taxId !== null && digits(s.taxId) !== "" && digits(s.taxId).startsWith(digits(taxId).slice(0, 8))) ??
    suppliers.map((s) => ({ s, sc: supplierName ? score(supplierName, s.name, "") : 0 })).filter((x) => x.sc >= 0.5).sort((a, b) => b.sc - a.sc)[0]?.s;

  const today = todayIso();
  const rawItems = Array.isArray(data["items"]) ? (data["items"] as Record<string, unknown>[]) : [];
  const lines: InvoiceLine[] = rawItems.slice(0, 40).map((it) => {
    const description = str(it["descripcion"]) ?? "(sin descripción)";
    const quantity = num(it["cantidad"]);
    const unitCost = num(it["costoUnitario"]);
    const expiresAt = date(it["vencimiento"]);
    const candidates = products
      .map((p) => ({ productId: p.id, name: p.name, sku: p.sku, purchasePrice: p.purchasePrice, score: score(description, p.name, p.sku) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const warnings: string[] = [];
    if (candidates.length === 0) warnings.push("No se parece a ningún producto del catálogo: elíjalo o créelo primero.");
    if (quantity === null) warnings.push("No se leyó la cantidad.");
    if (unitCost === null) warnings.push("No se leyó el costo unitario.");
    if (expiresAt === null) warnings.push("La factura no trae vencimiento: escríbalo desde el empaque.");
    else if (expiresAt < today) warnings.push("La fecha de vencimiento ya pasó: un lote vencido no puede ingresar.");
    const best = candidates[0];
    if (best && unitCost !== null && best.purchasePrice > 0 && Math.abs(unitCost - best.purchasePrice) / best.purchasePrice > 0.25) {
      warnings.push(`El costo difiere más de 25 % del precio de compra registrado ($ ${best.purchasePrice.toLocaleString("es-CO")}).`);
    }
    return { description, quantity, unitCost, expiresAt, lot: str(it["lote"]), candidates, warnings };
  });

  return {
    supplier: { name: supplierName, taxId, match: supplierMatch ? { supplierId: supplierMatch.id, name: supplierMatch.name } : null },
    invoiceNumber: str(data["numeroFactura"]),
    invoiceDate: date(data["fecha"]),
    lines,
    notes: str(data["observaciones"]),
  };
};
