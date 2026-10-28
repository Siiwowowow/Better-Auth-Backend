import { z } from "zod";
export const addressSchema = z.object({ label: z.string().max(50).optional(), recipientName: z.string().min(2).max(100), phone: z.string().min(8).max(20), addressLine: z.string().min(5).max(300), city: z.string().min(2).max(80), area: z.string().max(80).optional(), postalCode: z.string().max(20).optional(), isDefault: z.boolean().default(false) });
export const addressUpdateSchema = addressSchema.partial();
