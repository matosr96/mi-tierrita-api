import { z } from "zod";

export type CategoryRow = {
  id: number;
  name: string;
  active: boolean;
  createdAt: Date;
};

export type CategoryResponse = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
};

export const toCategoryResponse = (row: CategoryRow): CategoryResponse => ({
  id: row.id,
  name: row.name,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.active !== undefined, {
  message: "Debe enviar al menos un campo a modificar",
});
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
