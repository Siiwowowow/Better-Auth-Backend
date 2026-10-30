// src/app/module/category/category.service.ts
import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { ICreateCategoryPayload, IUpdateCategoryPayload } from "./category.interface.js";

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

const formatCategory = (category: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  bgColor?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { products: number };
}) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  image: category.image,
  bgColor: category.bgColor ?? "#E8F0F8",
  isActive: category.isActive,
  productCount: category._count?.products ?? 0,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const createCategory = async (payload: ICreateCategoryPayload) => {
  const name = payload.name.trim();
  const slug = generateSlug(payload.slug || name);

  const existing = await prisma.category.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { slug },
      ],
    },
  });

  if (existing) {
    throw new AppError(status.CONFLICT, "Category with this name or slug already exists");
  }

  const created = await prisma.category.create({
    data: {
      name,
      slug,
      description: payload.description || null,
      image: payload.image || null,
      bgColor: payload.bgColor || "#E8F0F8",
      isActive: payload.isActive ?? true,
    },
    include: {
      _count: { select: { products: true } },
    },
  });

  return formatCategory(created);
};

const getAllCategories = async (includeInactive: boolean = false) => {
  const categories = await prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });

  return categories.map(formatCategory);
};

const getCategoryById = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  return formatCategory(category);
};

const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  return formatCategory(category);
};

const updateCategory = async (id: string, payload: IUpdateCategoryPayload) => {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  const nextName = payload.name ? payload.name.trim() : category.name;
  let nextSlug = category.slug;

  if (payload.slug) {
    nextSlug = generateSlug(payload.slug);
  } else if (payload.name && payload.name.trim() !== category.name) {
    nextSlug = generateSlug(payload.name);
  }

  if (nextName !== category.name || nextSlug !== category.slug) {
    const existing = await prisma.category.findFirst({
      where: {
        id: { not: id },
        OR: [
          { name: { equals: nextName, mode: "insensitive" } },
          { slug: nextSlug },
        ],
      },
    });

    if (existing) {
      throw new AppError(status.CONFLICT, "Category with this name or slug already exists");
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      name: nextName,
      slug: nextSlug,
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.image !== undefined ? { image: payload.image || null } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    include: {
      _count: { select: { products: true } },
    },
  });

  return formatCategory(updated);
};

const deleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  if (category._count.products > 0) {
    if (category.slug === "uncategorized") {
      throw new AppError(
        status.BAD_REQUEST,
        "Cannot delete the Uncategorized category while products are still assigned to it."
      );
    }

    const fallback = await prisma.category.upsert({
      where: { slug: "uncategorized" },
      update: {},
      create: {
        name: "Uncategorized",
        slug: "uncategorized",
        description: "Default fallback category for reassigned products",
        isActive: true,
      },
    });

    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: fallback.id },
    });
  }

  const deleted = await prisma.category.delete({ where: { id } });
  return formatCategory({ ...deleted, _count: { products: 0 } });
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};
