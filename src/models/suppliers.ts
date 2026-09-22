import { createValidator } from "../common/validate";

export type SupplierRow = { id: number; name: string; taxId: string | null; phone: string | null; active: boolean; createdAt: Date };

export type SupplierResponse = Omit<SupplierRow, "createdAt"> & { createdAt: string };

export const toSupplierResponse = (row: SupplierRow): SupplierResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type CreateSupplierRequest = { name: string; taxId?: string | undefined; phone?: string | undefined };

export const parseCreateSupplier = (body: unknown): CreateSupplierRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 120 });
  const taxId = v.string("taxId", { max: 30 }, false);
  const phone = v.string("phone", { max: 30 }, false);
  v.done();
  return { name: name!, taxId, phone };
};

/** taxId y phone aceptan null explícito para borrar el dato; ausentes conservan el actual. */
export type UpdateSupplierRequest = {
  name?: string | undefined;
  taxId?: string | null | undefined;
  phone?: string | null | undefined;
  active?: boolean | undefined;
};

export const parseUpdateSupplier = (body: unknown): UpdateSupplierRequest => {
  const v = createValidator(body);
  const result: UpdateSupplierRequest = {
    name: v.string("name", { min: 1, max: 120 }, false),
    taxId: v.isNull("taxId") ? null : v.string("taxId", { max: 30 }, false),
    phone: v.isNull("phone") ? null : v.string("phone", { max: 30 }, false),
    active: v.boolean("active", false),
  };
  if (Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};
