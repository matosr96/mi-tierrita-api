import { createValidator } from "../common/validate";

export type CategoryRow = { id: number; name: string; active: boolean; createdAt: Date };

export type CategoryResponse = { id: number; name: string; active: boolean; createdAt: string };

export const toCategoryResponse = (row: CategoryRow): CategoryResponse => ({
  id: row.id,
  name: row.name,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

export type CreateCategoryRequest = { name: string };

export const parseCreateCategory = (body: unknown): CreateCategoryRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 80 });
  v.done();
  return { name: name! };
};

export type UpdateCategoryRequest = { name?: string | undefined; active?: boolean | undefined };

export const parseUpdateCategory = (body: unknown): UpdateCategoryRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 80 }, false);
  const active = v.boolean("active", false);
  if (name === undefined && active === undefined) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return { name, active };
};
