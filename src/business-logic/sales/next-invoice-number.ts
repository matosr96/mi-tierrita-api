import type { Queryable } from "../../data-sources/index";

/**
 * Correlativo visible de factura (documento 05): contador propio por año con bloqueo de
 * fila, independiente del id autoincremental. Formato FV-AAAA-NNNNNN.
 */
export const nextInvoiceNumber = async (q: Queryable): Promise<string> => {
  const year = new Date().getFullYear();
  const { rows } = await q.query<{ lastNumber: number }>(
    `INSERT INTO invoice_counters (year, last_number) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
     RETURNING last_number AS "lastNumber"`,
    [year],
  );
  const n = rows[0]?.lastNumber;
  if (n === undefined) throw new Error("No se pudo obtener el correlativo de factura");
  return `FV-${year}-${String(n).padStart(6, "0")}`;
};
