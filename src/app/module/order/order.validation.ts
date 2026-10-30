import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(3).optional(),
  email: z.string().email().optional().or(z.literal("")).or(z.undefined()),
  addressLine: z.string().trim().min(2).optional(),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  addressId: z.string().optional(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "DEMO", "COD", "ONLINE", "CARD", "BKASH", "NAGAD"]).default("CASH_ON_DELIVERY"),
  note: z.string().max(500).optional(),
  deliveryOption: z.string().optional(),
  deliveryFee: z.coerce.number().nonnegative().optional(),
  discountAmount: z.coerce.number().nonnegative().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productName: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        sku: z.string().trim().optional(),
        quantity: z.coerce.number().int().min(1).default(1),
        unitPrice: z.coerce.number().nonnegative().optional(),
        price: z.coerce.number().nonnegative().optional(),
        image: z.string().optional(),
      })
    )
    .optional(),
});

export const createAdminOrderSchema = z.object({
  customerName: z.string().trim().min(2),
  phone: z.string().trim().min(5),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().trim().min(2),
  city: z.string().trim().min(2).default("Dhaka"),
  area: z.string().trim().optional(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "DEMO"]).default("CASH_ON_DELIVERY"),
  paymentStatus: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED"]).default("UNPAID"),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).default("PENDING"),
  courier: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  deliveryFee: z.coerce.number().nonnegative().optional(),
  discountAmount: z.coerce.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productName: z.string().trim().min(1),
        sku: z.string().trim().optional(),
        quantity: z.coerce.number().int().min(1),
        unitPrice: z.coerce.number().nonnegative(),
      })
    )
    .min(1, "At least one order item is required"),
});

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED", "PENDING"]).optional().transform((val) => val === "PENDING" ? "UNPAID" : val),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "DEMO"]).optional(),
  courier: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  note: z.string().max(500).optional(),
  cancelReason: z.string().max(500).optional(),
  customerName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const bulkOrderStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED", "PENDING"]).optional().transform((val) => val === "PENDING" ? "UNPAID" : val),
});
