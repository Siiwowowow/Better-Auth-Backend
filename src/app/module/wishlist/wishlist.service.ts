import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
const list = (userId: string) => prisma.wishlist.findMany({ where: { userId }, include: { product: true }, orderBy: { id: "desc" } });
const add = async (userId: string, productId: string) => { const product = await prisma.product.findFirst({ where: { id: productId, status: "ACTIVE" } }); if (!product) throw new AppError(status.NOT_FOUND, "Product not found"); return prisma.wishlist.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} }); };
const remove = async (userId: string, productId: string) => { await prisma.wishlist.deleteMany({ where: { userId, productId } }); };
export const WishlistService = { list, add, remove };
