// src/app/module/category/category.validation.ts
import { z } from "zod";

export const createCategoryZodSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name too long"),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
});

export const updateCategoryZodSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
