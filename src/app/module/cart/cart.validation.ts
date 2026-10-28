import { z } from "zod";
export const cartItemSchema = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(999) });
