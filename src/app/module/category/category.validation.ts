// src/app/module/category/category.validation.ts
import { z } from "zod";

export const createCategoryZodSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name too long"),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateCategoryZodSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
