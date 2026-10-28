/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";

const list = async () =>
  prisma.review.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      product: { select: { id: true, name: true, slug: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
  });

const upsert = async (userId: string, data: any) => {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id: data.productId }, { slug: data.productId }, { name: data.productId }],
    },
  });
  if (!product) throw new AppError(status.NOT_FOUND, "Product not found");

  return prisma.review.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: {
      userId,
      productId: product.id,
      rating: Number(data.rating),
      comment: data.comment || null,
      isPublished: data.isPublished ?? true,
    },
    update: {
      rating: Number(data.rating),
      comment: data.comment,
      ...(data.isPublished !== undefined ? { isPublished: Boolean(data.isPublished) } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      product: { select: { id: true, name: true, slug: true, sku: true } },
    },
  });
};

const update = async (id: string, data: any) => {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw new AppError(status.NOT_FOUND, "Review not found");

  return prisma.review.update({
    where: { id },
    data: {
      ...(data.rating !== undefined ? { rating: Number(data.rating) } : {}),
      ...(data.comment !== undefined ? { comment: data.comment } : {}),
      ...(data.isPublished !== undefined ? { isPublished: Boolean(data.isPublished) } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      product: { select: { id: true, name: true, slug: true, sku: true } },
    },
  });
};

const remove = async (userId: string, id: string, isAdmin = false) => {
  const result = await prisma.review.deleteMany({
    where: isAdmin ? { id } : { id, userId },
  });
  if (!result.count) throw new AppError(status.NOT_FOUND, "Review not found");
  return { id };
};

export const ReviewService = { list, upsert, update, remove };
