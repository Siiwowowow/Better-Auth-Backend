import { z } from "zod";

export const variantInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1).optional(),
  color: z.string().optional().nullable(),
  colorHex: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  attributes: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  price: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nonnegative().nullable().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockAt: z.coerce.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).optional(),
  sku: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(5000).nullable().optional(),
  shortDescription: z.string().max(1000).nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().nonnegative().nullable().optional(),
  discountPrice: z.coerce.number().nonnegative().nullable().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockAt: z.coerce.number().int().min(0).default(5),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  isWholesale: z.boolean().default(false),
  minWholesaleQty: z.coerce.number().int().min(1).default(1),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  showInHome: z.boolean().default(true),
  showEveryday: z.boolean().default(false),
  showInShop: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  specifications: z.record(z.string(), z.unknown()).optional(),
  images: z.array(z.string().min(1)).default([]),
  categoryId: z.string().min(1),
  variants: z.array(variantInputSchema).optional(),
});

export const productUpdateSchema = productSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  includeAll: z.union([z.boolean(), z.string()]).optional(),
});
