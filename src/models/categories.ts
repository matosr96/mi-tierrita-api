import { createValidator, type Validator } from "../common/validate";

/** `code` solo lo tienen las seis líneas de la página pública (migración 0018); las categorías internas lo llevan nulo. */
export type CategoryRow = { id: number; name: string; code: string | null; description: string | null; tags: string[]; active: boolean; createdAt: Date };

export type CategoryResponse = { id: number; name: string; code: string | null; description: string | null; tags: string[]; active: boolean; createdAt: string };

export const toCategoryResponse = (row: CategoryRow): CategoryResponse => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  tags: row.tags,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

/** Lo único que ve la página pública de una línea: ni id, ni estado, ni fechas. */
export type PublicCategoryResponse = { code: string; name: string; description: string | null; tags: string[] };

export const toPublicCategoryResponse = (row: Pick<CategoryRow, "code" | "name" | "description" | "tags">): PublicCategoryResponse => ({
  code: row.code ?? "",
  name: row.name,
  description: row.description,
  tags: row.tags,
});

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 40;

/** Subfamilias: lista de hasta 12 textos de 1 a 40 caracteres, sin repetidos ni vacíos. `undefined` si no vino. */
const parseTags = (v: Validator, body: unknown): string[] | undefined => {
  const raw = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>)["tags"] : undefined;
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    v.custom("tags", "Debe ser una lista");
    return undefined;
  }
  if (raw.length > MAX_TAGS) {
    v.custom("tags", `Máximo ${MAX_TAGS} elementos`);
    return undefined;
  }
  const tags: string[] = [];
  raw.forEach((item, i) => {
    if (typeof item !== "string") return v.custom(`tags[${i}]`, "Debe ser texto");
    const value = item.trim();
    if (value.length < 1) return v.custom(`tags[${i}]`, "Mínimo 1 caracteres");
    if (value.length > MAX_TAG_LENGTH) return v.custom(`tags[${i}]`, `Máximo ${MAX_TAG_LENGTH} caracteres`);
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return v.custom(`tags[${i}]`, "Subfamilia repetida");
    tags.push(value);
  });
  return tags;
};

export type CreateCategoryRequest = { name: string; description?: string | undefined; tags?: string[] | undefined };

export const parseCreateCategory = (body: unknown): CreateCategoryRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 80 });
  const description = v.string("description", { min: 1, max: 200 }, false);
  const tags = parseTags(v, body);
  v.done();
  return { name: name!, description, tags };
};

/** `description: null` borra la descripción; `tags: []` deja la línea sin subfamilias. */
export type UpdateCategoryRequest = { name?: string | undefined; active?: boolean | undefined; description?: string | null | undefined; tags?: string[] | undefined };

export const parseUpdateCategory = (body: unknown): UpdateCategoryRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 80 }, false);
  const active = v.boolean("active", false);
  const description = v.isNull("description") ? null : v.string("description", { min: 1, max: 200 }, false);
  const tags = parseTags(v, body);
  if (name === undefined && active === undefined && description === undefined && tags === undefined) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return { name, active, description, tags };
};
