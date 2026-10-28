import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
const get = (userId: string) => prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: true, variant: true }, orderBy: { id: "asc" } } } });
const upsert = async (userId: string, productId: string, quantity: number, variantId?: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "ACTIVE") throw new AppError(status.NOT_FOUND, "Product not found");
  const variant = variantId ? await prisma.productVariant.findFirst({ where: { id: variantId, productId, isActive: true } }) : null;
  if (variantId && !variant) throw new AppError(status.NOT_FOUND, "Product variant not found");
  if (quantity > (variant?.stock ?? product.stock)) throw new AppError(status.BAD_REQUEST, "Requested quantity is unavailable");
  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId, variantId: variantId ?? null } });
  return existing
    ? prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } })
    : prisma.cartItem.create({ data: { cartId: cart.id, productId, variantId, quantity } });
};
const remove = async (userId: string, productId: string) => { const cart = await prisma.cart.findUnique({ where: { userId } }); if (!cart) return; await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } }); };
const clear = async (userId: string) => { const cart = await prisma.cart.findUnique({ where: { userId } }); if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }); };
export const CartService = { get, upsert, remove, clear };
