/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `product-${Date.now()}`;

const ensureUniqueSlug = async (base: string, excludeId?: string) => {
  const clean = slugify(base);
  let candidate = clean;
  let counter = 1;
  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${clean}-${counter}`;
    counter += 1;
  }
};

const ensureUniqueSku = async (base: string, excludeId?: string) => {
  const clean = base.trim().toUpperCase().replace(/\s+/g, "-") || `SKU-${Date.now()}`;
  let candidate = clean;
  let counter = 1;
  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        sku: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${clean}-${counter}`;
    counter += 1;
  }
};

const ensureCategory = async (categoryIdOrName: string): Promise<string> => {
  const byId = await prisma.category.findFirst({
    where: {
      OR: [
        { id: categoryIdOrName },
        { slug: categoryIdOrName.toLowerCase().trim() },
        { name: { equals: categoryIdOrName.trim(), mode: "insensitive" } },
      ],
    },
  });
  if (byId) return byId.id;

  const created = await prisma.category.create({
    data: {
      name: categoryIdOrName.trim() || "General",
      slug: slugify(categoryIdOrName || "general"),
      isActive: true,
    },
  });
  return created.id;
};

const resolveProductStatus = (data: any, fallback?: "ACTIVE" | "DRAFT" | "ARCHIVED"): "ACTIVE" | "DRAFT" | "ARCHIVED" => {
  if (typeof data?.status === "string") {
    const upper = data.status.toUpperCase();
    if (upper === "ACTIVE" || upper === "DRAFT" || upper === "ARCHIVED") {
      return upper;
    }
  }
  const specStatus = data?.specifications?.__status;
  if (typeof specStatus === "string") {
    const upper = specStatus.toUpperCase();
    if (upper === "ARCHIVED") return "ARCHIVED";
    if (upper === "DRAFT") return "DRAFT";
    if (upper === "ACTIVE") return "ACTIVE";
  }
  if (typeof data?.isActive === "boolean") {
    return data.isActive ? "ACTIVE" : "DRAFT";
  }
  return fallback || "ACTIVE";
};

const formatProduct = (product: any) => {
  const sold = Array.isArray(product.orderItems)
    ? product.orderItems.reduce((sum: number, item: { quantity: number }) => sum + (Number(item.quantity) || 0), 0)
    : Number(product.sold || 0);

  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;

  return {
    ...product,
    price: Number(product.price),
    compareAtPrice: compareAt,
    discountPrice: compareAt,
    isActive: product.status === "ACTIVE",
    isFeatured: Boolean(product.isFeatured),
    isTrending: Boolean(product.isTrending),
    showInHome: product.showInHome !== false,
    showEveryday: Boolean(product.showEveryday),
    showInShop: product.showInShop !== false,
    tags: Array.isArray(product.tags) ? product.tags : [],
    sold,
    variants: Array.isArray(product.variants)
      ? product.variants.map((v: any) => ({
          ...v,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
          color: v.attributes?.color ?? null,
          colorHex: v.attributes?.colorHex ?? v.attributes?.color ?? null,
          image: v.attributes?.image ?? null,
          size: v.attributes?.size ?? null,
        }))
      : [],
  };
};

const productInclude = {
  category: true,
  variants: { orderBy: { createdAt: "asc" as const } },
  orderItems: { select: { quantity: true } },
  reviews: {
    where: { isPublished: true },
    select: {
      id: true,
      rating: true,
      comment: true,
      isPublished: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

const list = async (query: any = {}, includeDraft = false) => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(Math.max(1, Number(query.limit || 50)), 200);
  const showAll =
    includeDraft ||
    query.includeAll === true ||
    query.includeAll === "true" ||
    Boolean(query.status);

  const where: any = {
    ...(showAll ? {} : { status: "ACTIVE" }),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.isWholesale !== undefined
      ? { isWholesale: query.isWholesale === true || query.isWholesale === "true" }
      : {}),
  };

  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { category: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
  }

  const [rawItems, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rawItems.map(formatProduct),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const get = async (idOrSlug: string) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: productInclude,
  });
  if (!product) throw new AppError(status.NOT_FOUND, "Product not found");
  return formatProduct(product);
};

const parseAttributes = (attr: unknown) => {
  if (!attr) return {};
  if (typeof attr === "string") {
    try {
      return JSON.parse(attr);
    } catch {
      return { option: attr };
    }
  }
  return attr;
};

const create = async (data: any) => {
  const categoryId = await ensureCategory(data.categoryId || "General");
  const slug = await ensureUniqueSlug(data.slug || data.name);
  const sku = await ensureUniqueSku(data.sku || `AN-${Date.now().toString().slice(-6)}`);

  const variantsInput = Array.isArray(data.variants) ? data.variants : [];

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: data.name.trim(),
        slug,
        sku,
        description: data.description ?? null,
        brand: data.brand ?? null,
        price: Number(data.price),
        compareAtPrice:
          (data.compareAtPrice ?? data.discountPrice) !== undefined && (data.compareAtPrice ?? data.discountPrice) !== null && (data.compareAtPrice ?? data.discountPrice) !== ""
            ? Number(data.compareAtPrice ?? data.discountPrice)
            : null,
        stock: Number(data.stock ?? 0),
        lowStockAt: Number(data.lowStockAt ?? 5),
        status: resolveProductStatus(data, "ACTIVE"),
        isWholesale: Boolean(data.isWholesale),
        minWholesaleQty: Number(data.minWholesaleQty ?? 1),
        isFeatured: Boolean(data.isFeatured),
        isTrending: Boolean(data.isTrending),
        showInHome: data.showInHome !== undefined ? Boolean(data.showInHome) : true,
        showEveryday: Boolean(data.showEveryday),
        showInShop: data.showInShop !== undefined ? Boolean(data.showInShop) : true,
        tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
        images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
        categoryId,
      },
    });

    for (let idx = 0; idx < variantsInput.length; idx += 1) {
      const v = variantsInput[idx];
      if (!v?.name) continue;
      const variantSku = `${sku}-${(v.sku || v.name).toString().trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "")}-${idx + 1}`;
      const vAttrs = {
        color: v.color || v.name,
        colorHex: v.colorHex || v.color || "#ff5500",
        image: v.image || (Array.isArray(data.images) && data.images[0]) || null,
        size: v.size || null,
        ...(typeof v.attributes === "object" ? v.attributes : {}),
      };
      await tx.productVariant.create({
        data: {
          productId: product.id,
          name: String(v.name).trim(),
          sku: v.sku ? `${String(v.sku).trim()}-${product.id.slice(0, 4)}` : variantSku,
          attributes: vAttrs,
          price: Number(v.price ?? data.price ?? 0),
          compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
          stock: Number(v.stock ?? 0),
          lowStockAt: Number(v.lowStockAt ?? 5),
          isActive: v.isActive ?? true,
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude,
    });
  });

  return formatProduct(created);
};

const update = async (id: string, data: any) => {
  const existing = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { variants: true },
  });
  if (!existing) throw new AppError(status.NOT_FOUND, "Product not found");

  const targetId = existing.id;
  const updatePayload: any = {};

  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.slug !== undefined) {
    updatePayload.slug = await ensureUniqueSlug(data.slug, targetId);
  } else if (data.name !== undefined && data.name.trim() !== existing.name) {
    updatePayload.slug = await ensureUniqueSlug(data.name, targetId);
  }
  if (data.sku !== undefined && data.sku.trim() !== existing.sku) {
    updatePayload.sku = await ensureUniqueSku(data.sku, targetId);
  }
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.brand !== undefined) updatePayload.brand = data.brand;
  if (data.price !== undefined) updatePayload.price = Number(data.price);
  if (data.compareAtPrice !== undefined || data.discountPrice !== undefined) { const cmpVal = data.compareAtPrice !== undefined ? data.compareAtPrice : data.discountPrice;
    updatePayload.compareAtPrice =
      data.compareAtPrice !== null && data.compareAtPrice !== "" ? Number(data.compareAtPrice ?? data.discountPrice) : null;
  }
  if (data.stock !== undefined) updatePayload.stock = Number(data.stock);
  if (data.lowStockAt !== undefined) updatePayload.lowStockAt = Number(data.lowStockAt);
  if (data.status !== undefined || data.isActive !== undefined || data.specifications?.__status !== undefined) { updatePayload.status = resolveProductStatus(data, existing.status as any); }
  if (data.isWholesale !== undefined) updatePayload.isWholesale = Boolean(data.isWholesale);
  if (data.minWholesaleQty !== undefined) updatePayload.minWholesaleQty = Number(data.minWholesaleQty);
  if (data.isFeatured !== undefined) updatePayload.isFeatured = Boolean(data.isFeatured);
  if (data.isTrending !== undefined) updatePayload.isTrending = Boolean(data.isTrending);
  if (data.showInHome !== undefined) updatePayload.showInHome = Boolean(data.showInHome);
  if (data.showEveryday !== undefined) updatePayload.showEveryday = Boolean(data.showEveryday);
  if (data.showInShop !== undefined) updatePayload.showInShop = Boolean(data.showInShop);
  if (data.tags !== undefined) updatePayload.tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  if (data.images !== undefined) {
    updatePayload.images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  }
  if (data.categoryId !== undefined) {
    updatePayload.categoryId = await ensureCategory(data.categoryId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: targetId },
      data: updatePayload,
    });

    if (Array.isArray(data.variants)) {
      const incomingIds = data.variants.map((v: any) => v.id).filter(Boolean);
      const toDelete = existing.variants.filter((ev) => !incomingIds.includes(ev.id));

      for (const rem of toDelete) {
        await tx.inventoryTransaction.deleteMany({ where: { variantId: rem.id } });
        await tx.cartItem.deleteMany({ where: { variantId: rem.id } });
        const orderItemCount = await tx.orderItem.count({ where: { variantId: rem.id } });
        if (orderItemCount === 0) {
          await tx.productVariant.delete({ where: { id: rem.id } });
        } else {
          await tx.productVariant.update({ where: { id: rem.id }, data: { isActive: false } });
        }
      }

      for (let idx = 0; idx < data.variants.length; idx += 1) {
        const v = data.variants[idx];
        if (!v?.name) continue;
        const vAttrs = {
          color: v.color || v.name,
          colorHex: v.colorHex || v.color || "#ff5500",
          image: v.image || (Array.isArray(data.images) ? data.images[0] : existing.images?.[0]) || null,
          size: v.size || null,
          ...(typeof v.attributes === "object" ? v.attributes : {}),
        };
        if (v.id && existing.variants.some((ev) => ev.id === v.id)) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              name: String(v.name).trim(),
              sku: String(v.sku || `${existing.sku}-V${idx + 1}`).trim(),
              attributes: vAttrs,
              price: Number(v.price ?? existing.price),
              compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
              stock: Number(v.stock ?? 0),
              lowStockAt: Number(v.lowStockAt ?? 5),
              isActive: v.isActive ?? true,
            },
          });
        } else {
          const uniqueVarSku = `${String(v.sku || existing.sku).trim()}-${Date.now().toString().slice(-4)}-${idx}`;
          await tx.productVariant.create({
            data: {
              productId: targetId,
              name: String(v.name).trim(),
              sku: uniqueVarSku,
              attributes: vAttrs,
              price: Number(v.price ?? existing.price),
              compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
              stock: Number(v.stock ?? 0),
              lowStockAt: Number(v.lowStockAt ?? 5),
              isActive: v.isActive ?? true,
            },
          });
        }
      }
    }

    return tx.product.findUniqueOrThrow({
      where: { id: targetId },
      include: productInclude,
    });
  });

  return formatProduct(updated);
};

const createVariant = async (productId: string, data: any) => {
  const prod = await get(productId);
  return prisma.productVariant.create({
    data: {
      productId: prod.id,
      name: data.name,
      sku: data.sku,
      attributes: parseAttributes(data.attributes),
      price: Number(data.price),
      compareAtPrice: data.compareAtPrice != null ? Number(data.compareAtPrice ?? data.discountPrice) : null,
      stock: Number(data.stock ?? 0),
      lowStockAt: Number(data.lowStockAt ?? 5),
      isActive: data.isActive ?? true,
    },
  });
};

const updateVariant = async (id: string, data: any) =>
  prisma.productVariant.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sku !== undefined ? { sku: data.sku } : {}),
      ...(data.attributes !== undefined ? { attributes: parseAttributes(data.attributes) } : {}),
      ...(data.price !== undefined ? { price: Number(data.price) } : {}),
      ...(data.compareAtPrice !== undefined
        ? { compareAtPrice: data.compareAtPrice != null ? Number(data.compareAtPrice ?? data.discountPrice) : null }
        : {}),
      ...(data.stock !== undefined ? { stock: Number(data.stock) } : {}),
      ...(data.lowStockAt !== undefined ? { lowStockAt: Number(data.lowStockAt) } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
    },
  });

const deleteVariant = async (id: string) => {
  await prisma.inventoryTransaction.deleteMany({ where: { variantId: id } });
  await prisma.cartItem.deleteMany({ where: { variantId: id } });
  await prisma.orderItem.updateMany({ where: { variantId: id }, data: { variantId: null } });
  return prisma.productVariant.delete({ where: { id } });
};

const duplicate = async (id: string) => {
  const original = await get(id);
  const newName = `${original.name} (Copy)`;
  return create({
    name: newName,
    slug: `${original.slug}-copy`,
    sku: `${original.sku}-COPY`,
    description: original.description,
    brand: original.brand,
    price: original.price,
    compareAtPrice: original.compareAtPrice,
    stock: original.stock,
    lowStockAt: original.lowStockAt,
    status: "DRAFT",
    isWholesale: original.isWholesale,
    minWholesaleQty: original.minWholesaleQty,
    images: original.images,
    categoryId: original.categoryId,
    variants: (original.variants || []).map((v: any) => ({
      name: v.name,
      sku: `${v.sku}-COPY`,
      attributes: v.attributes,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      isActive: v.isActive,
    })),
  });
};

const remove = async (id: string) => {
  const existing = await get(id);
  const targetId = existing.id;

  await prisma.$transaction(async (tx) => {
    const variantIds = (existing.variants || []).map((v: any) => v.id);
    if (variantIds.length > 0) {
      await tx.inventoryTransaction.deleteMany({ where: { variantId: { in: variantIds } } });
    }
    await tx.cartItem.deleteMany({ where: { productId: targetId } });
    await tx.wishlist.deleteMany({ where: { productId: targetId } });
    await tx.review.deleteMany({ where: { productId: targetId } });
    await tx.orderItem.deleteMany({ where: { productId: targetId } });
    await tx.productVariant.deleteMany({ where: { productId: targetId } });
    await tx.product.delete({ where: { id: targetId } });
  });

  return existing;
};

export const ProductService = {
  list,
  get,
  create,
  update,
  remove,
  duplicate,
  createVariant,
  updateVariant,
  deleteVariant,
};

