/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import status from "http-status";
import { DiscountType, Role, userStatus } from "@prisma/client";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";

export type ResourceTone = "orange" | "emerald" | "blue" | "violet" | "rose" | "amber";

export interface ResourceMetric {
  label: string;
  value: string;
  change: string;
  tone: ResourceTone;
}

export interface ResourceField {
  key: string;
  label: string;
  value: string;
  type?: "input" | "textarea" | "select" | "toggle" | "number";
  options?: string[];
  required?: boolean;
}

export interface ResourcePayload {
  resource: string;
  title: string;
  description: string;
  search: string;
  createLabel: string;
  drawerTitle: string;
  metrics: ResourceMetric[];
  tabs: { label: string; count: string }[];
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  fields: ResourceField[];
  showcase?: { name: string; meta: string; tone: ResourceTone }[];
}

const formatDate = (value?: Date | string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatMoney = (value: number) => `৳ ${Math.round(value || 0).toLocaleString("en-BD")}`;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `item-${Date.now()}`;

const parseNum = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const cleaned = String(value ?? "").replace(/[^0-9.-]+/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
};

const tones: ResourceTone[] = ["orange", "emerald", "blue", "violet", "rose", "amber"];

const buildMetrics = (
  items: [string, string | number, string?][]
): ResourceMetric[] =>
  items.map(([label, val, change], idx) => ({
    label,
    value: typeof val === "number" ? val.toLocaleString("en-BD") : val,
    change: change || "Live DB",
    tone: tones[idx % tones.length],
  }));

// 1. CATEGORIES
const getCategoriesResource = async (): Promise<ResourcePayload> => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { createdAt: "desc" },
  });

  const activeCount = categories.filter((c) => c.isActive).length;
  const inactiveCount = categories.length - activeCount;
  const totalAssigned = categories.reduce((sum, c) => sum + c._count.products, 0);

  const rows = categories.map((cat, idx) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description || "—",
    products: String(cat._count.products),
    status: cat.isActive ? "Active" : "Inactive",
    position: String(idx + 1),
    created: formatDate(cat.createdAt),
    image: cat.image || "",
  }));

  return {
    resource: "categories",
    title: "Categories Management",
    description: "Organize products with categories, slugs, descriptions and active visibility.",
    search: "Search categories by name or slug...",
    createLabel: "Add Category",
    drawerTitle: "Category Details",
    metrics: buildMetrics([
      ["Total Categories", categories.length],
      ["Active Categories", activeCount],
      ["Products Assigned", totalAssigned],
      ["Inactive Categories", inactiveCount],
    ]),
    tabs: [
      { label: "All", count: String(categories.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Inactive", count: String(inactiveCount) },
    ],
    columns: [
      { key: "name", label: "Category Name" },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description" },
      { key: "products", label: "Products" },
      { key: "status", label: "Status" },
      { key: "created", label: "Created At" },
    ],
    rows,
    fields: [
      { key: "name", label: "Category Name", value: "", required: true },
      { key: "slug", label: "Slug", value: "" },
      { key: "description", label: "Description", value: "", type: "textarea" },
      { key: "image", label: "Image URL", value: "" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Inactive"] },
    ],
    showcase: categories.slice(0, 7).map((c, idx) => ({
      name: c.name,
      meta: `${c._count.products} Products`,
      tone: tones[idx % tones.length],
    })),
  };
};

// 2. INVENTORY
const getInventoryResource = async (): Promise<ResourcePayload> => {
  const [products, warehouses, pendingOrderItems] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
        variants: {
          include: {
            inventory: {
              include: { warehouse: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { stock: "asc" },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
      },
      select: { productId: true, quantity: true },
    }),
  ]);

  const defaultWarehouse = warehouses[0]?.name || "Dhaka Central";
  const reservedMap = new Map<string, number>();
  for (const item of pendingOrderItems) {
    reservedMap.set(item.productId, (reservedMap.get(item.productId) || 0) + item.quantity);
  }

  const rows = products.map((p) => {
    const reserved = reservedMap.get(p.id) || 0;
    const latestWarehouse =
      p.variants?.[0]?.inventory?.[0]?.warehouse?.name || defaultWarehouse;
    const threshold = p.lowStockAt ?? 5;
    const stockStatus =
      p.stock <= 0
        ? "Critical"
        : p.stock <= Math.min(3, threshold)
        ? "Critical"
        : p.stock <= threshold
        ? "Low Stock"
        : "In Stock";

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      warehouse: latestWarehouse,
      stock: String(p.stock),
      lowStockAt: String(threshold),
      reserved: String(reserved),
      status: stockStatus,
      price: String(Number(p.price)),
    };
  });

  const inStockCount = rows.filter((r) => r.status === "In Stock").length;
  const lowStockCount = rows.filter((r) => r.status === "Low Stock").length;
  const criticalCount = rows.filter((r) => r.status === "Critical").length;

  return {
    resource: "inventory",
    title: "Inventory Control",
    description: "Monitor stock levels, warehouses, movements and replenishment alerts.",
    search: "Search products by name, SKU or warehouse...",
    createLabel: "Add Stock Entry",
    drawerTitle: "Inventory Entry",
    metrics: buildMetrics([
      ["Total SKUs", rows.length],
      ["In Stock", inStockCount],
      ["Low Stock", lowStockCount],
      ["Critical / Out", criticalCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "In Stock", count: String(inStockCount) },
      { label: "Low Stock", count: String(lowStockCount) },
      { label: "Critical", count: String(criticalCount) },
    ],
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "warehouse", label: "Warehouse" },
      { key: "stock", label: "Available" },
      { key: "lowStockAt", label: "Alert Threshold" },
      { key: "reserved", label: "Reserved" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Product Name", value: "", required: true },
      { key: "sku", label: "SKU", value: "", required: true },
      { key: "warehouse", label: "Warehouse", value: defaultWarehouse },
      { key: "stock", label: "Available Stock", value: "0", type: "number", required: true },
      { key: "lowStockAt", label: "Alert Threshold", value: "5", type: "number" },
      { key: "price", label: "Unit Price (৳)", value: "1000", type: "number" },
    ],
  };
};

// 3. CUSTOMERS
const getCustomersResource = async (): Promise<ResourcePayload> => {
  const users = await prisma.user.findMany({
    where: { role: Role.USER, isDeleted: false },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { total: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = users.map((u) => {
    const addr = u.addresses[0];
    const phone = addr?.phone || "—";
    const location = addr?.city || "Dhaka";
    const addressLine = addr?.addressLine || "";
    const orderCount = u.orders.length;
    const totalSpent = u.orders.reduce((sum, o) => sum + Number(o.total), 0);
    const lastOrderDate = u.orders[0]?.createdAt ? formatDate(u.orders[0].createdAt) : "No orders yet";
    const group = totalSpent >= 10000 || orderCount >= 5 ? "VIP" : "Regular";
    const statusLabel =
      u.status === "ACTIVE"
        ? "Active"
        : u.status === "BLOCKED"
        ? "Blocked"
        : "Pending";

    return {
      id: u.id,
      name: u.name || u.email.split("@")[0],
      email: u.email,
      phone,
      contact: `${phone} · ${u.email}`,
      location,
      addressLine,
      orders: String(orderCount),
      spent: formatMoney(totalSpent),
      lastOrder: lastOrderDate,
      status: statusLabel,
      group,
    };
  });

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const blockedCount = rows.filter((r) => r.status !== "Active").length;
  const vipCount = rows.filter((r) => r.group === "VIP").length;

  return {
    resource: "customers",
    title: "Customers Management",
    description: "Manage customers, review order history and build stronger customer relationships.",
    search: "Search customers by name, phone, email, city...",
    createLabel: "Add Customer",
    drawerTitle: "Customer Details",
    metrics: buildMetrics([
      ["Total Customers", rows.length],
      ["Active Customers", activeCount],
      ["VIP Customers", vipCount],
      ["Blocked / Inactive", blockedCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Blocked", count: String(blockedCount) },
      { label: "VIP", count: String(vipCount) },
    ],
    columns: [
      { key: "name", label: "Customer" },
      { key: "contact", label: "Contact" },
      { key: "location", label: "Location" },
      { key: "orders", label: "Total Orders" },
      { key: "spent", label: "Total Spent" },
      { key: "lastOrder", label: "Last Order" },
      { key: "status", label: "Status" },
      { key: "group", label: "Group" },
    ],
    rows,
    fields: [
      { key: "name", label: "Customer Name", value: "", required: true },
      { key: "email", label: "Email Address", value: "", required: true },
      { key: "phone", label: "Phone Number", value: "" },
      { key: "location", label: "City / Location", value: "Dhaka" },
      { key: "addressLine", label: "Street Address", value: "", type: "textarea" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Blocked"] },
    ],
  };
};

const parseCouponUsageLimit = (usageLimitRaw: unknown, usageRaw: unknown, fallback = 100): number => {
  if (usageLimitRaw !== undefined && usageLimitRaw !== null && String(usageLimitRaw).trim() !== "") {
    return Math.max(1, Math.round(parseNum(usageLimitRaw, fallback)));
  }
  const str = String(usageRaw ?? "").trim();
  if (str.includes("/")) {
    const afterSlash = str.split("/")[1];
    return Math.max(1, Math.round(parseNum(afterSlash, fallback)));
  }
  return Math.max(1, Math.round(parseNum(str, fallback)));
};

const parseCouponExpiry = (raw: unknown): Date | null => {
  const str = String(raw ?? "").trim();
  if (!str || /^(ongoing|no expiry|unlimited|never|-)$/i.test(str)) {
    return null;
  }
  const daysMatch = str.match(/^(\d+)\s*day/i);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    if (Number.isFinite(days) && days > 0) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      target.setHours(23, 59, 59, 999);
      return target;
    }
  }
  const cleaned = str.replace(/^until\s+/i, "").trim();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};
// 4. COUPONS
const getCouponsResource = async (): Promise<ResourcePayload> => {
  const [coupons, metaLogs] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { entity: "COUPON_META" } }),
  ]);

  const metaMap = new Map<string, any>();
  for (const log of metaLogs) {
    if (log.entityId) metaMap.set(log.entityId, log.metadata || {});
  }

  const now = new Date();
  const rows = coupons.map((c) => {
    const meta = metaMap.get(c.id) || {};
    const isExpired = c.expiresAt && new Date(c.expiresAt) < now;
    const isScheduled = c.startsAt && new Date(c.startsAt) > now;
    const statusLabel = !c.isActive
      ? "Inactive"
      : isExpired
      ? "Expired"
      : isScheduled
      ? "Scheduled"
      : "Active";

    const typeLabel = c.type === "PERCENTAGE" ? "Percentage" : "Fixed Amount";
    const discountLabel =
      c.type === "PERCENTAGE" ? `${Number(c.value)}%` : formatMoney(Number(c.value));
    const minLabel = c.minimumOrder ? formatMoney(Number(c.minimumOrder)) : "৳ 0";
    const usageLabel = `${c.usedCount} / ${c.usageLimit ?? "∞"}`;
    const validityLabel = c.expiresAt ? `Until ${formatDate(c.expiresAt)}` : "No expiry";

    return {
      id: c.id,
      code: c.code,
      name: meta.name || `${c.code} Offer`,
      description: meta.description || "",
      type: typeLabel,
      discountValue: String(Number(c.value)),
      discount: discountLabel,
      minimumOrder: String(Number(c.minimumOrder || 0)),
      minimum: minLabel,
      usageLimit: String(c.usageLimit || 100),
      usage: usageLabel,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : "",
      validity: validityLabel,
      status: statusLabel,
    };
  });

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const expiredCount = rows.filter((r) => r.status === "Expired" || r.status === "Inactive").length;
  const totalUsage = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return {
    resource: "coupons",
    title: "Coupons & Offers",
    description: "Create and manage discount coupons, special offers and promotional campaigns.",
    search: "Search coupons by code or offer name...",
    createLabel: "Create Coupon",
    drawerTitle: "Coupon Details",
    metrics: buildMetrics([
      ["Total Coupons", rows.length],
      ["Active Coupons", activeCount],
      ["Total Redemptions", totalUsage],
      ["Expired / Inactive", expiredCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Expired", count: String(expiredCount) },
    ],
    columns: [
      { key: "code", label: "Coupon Code" },
      { key: "name", label: "Offer Name" },
      { key: "type", label: "Type" },
      { key: "discount", label: "Discount" },
      { key: "minimum", label: "Min. Purchase" },
      { key: "usage", label: "Usage" },
      { key: "validity", label: "Validity" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "code", label: "Coupon Code", value: "", required: true },
      { key: "name", label: "Offer Name", value: "", required: true },
      { key: "type", label: "Discount Type", value: "Percentage", type: "select", options: ["Percentage", "Fixed Amount"] },
      { key: "discountValue", label: "Discount Value", value: "10", type: "number", required: true },
      { key: "minimumOrder", label: "Minimum Purchase (৳)", value: "500", type: "number" },
      { key: "usageLimit", label: "Usage Limit", value: "100", type: "number" },
      { key: "expiresAt", label: "Expiry Date (YYYY-MM-DD)", value: "" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Inactive"] },
    ],
  };
};

// 5. REVIEWS
const getReviewsResource = async (): Promise<ResourcePayload> => {
  const reviews = await prisma.review.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = reviews.map((r) => {
    const stars = "★".repeat(Math.max(1, Math.min(5, r.rating))) + "☆".repeat(Math.max(0, 5 - r.rating));
    return {
      id: r.id,
      type: "Review",
      name: r.user?.name || r.user?.email || "Customer",
      product: r.product?.name || "Product",
      productId: r.productId,
      content: r.comment || "—",
      ratingNum: String(r.rating),
      rating: `${stars} ${r.rating}.0`,
      status: r.isPublished ? "Approved" : "Pending",
      date: formatDate(r.createdAt),
    };
  });

  const approvedCount = rows.filter((r) => r.status === "Approved").length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  return {
    resource: "reviews",
    title: "Reviews & Q&A",
    description: "Manage customer reviews, ratings, approvals and product feedback.",
    search: "Search reviews by customer, product or comment...",
    createLabel: "Add Review",
    drawerTitle: "Review Details",
    metrics: buildMetrics([
      ["Total Reviews", rows.length],
      ["Average Rating", `${avgRating} / 5`],
      ["Approved", approvedCount],
      ["Pending Approval", pendingCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Approved", count: String(approvedCount) },
      { label: "Pending", count: String(pendingCount) },
    ],
    columns: [
      { key: "type", label: "Type" },
      { key: "name", label: "Customer" },
      { key: "product", label: "Product" },
      { key: "content", label: "Content" },
      { key: "rating", label: "Rating" },
      { key: "status", label: "Status" },
      { key: "date", label: "Date" },
    ],
    rows,
    fields: [
      { key: "name", label: "Customer Name or Email", value: "", required: true },
      { key: "product", label: "Product Name or SKU", value: "", required: true },
      { key: "ratingNum", label: "Rating (1-5)", value: "5", type: "select", options: ["5", "4", "3", "2", "1"] },
      { key: "content", label: "Review Comment", value: "", type: "textarea", required: true },
      { key: "status", label: "Status", value: "Approved", type: "select", options: ["Approved", "Pending"] },
    ],
  };
};

// 6. EMPLOYEES & ROLES
const getEmployeesResource = async (): Promise<ResourcePayload> => {
  const admins = await prisma.admin.findMany({
    where: { isDeleted: false },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = admins.map((a) => ({
    id: a.id,
    userId: a.userId,
    name: a.name || a.user?.name || "Admin",
    email: a.email || a.user?.email || "",
    contactNumber: a.contactNumber || "—",
    role: a.user?.role || "ADMIN",
    department: "Management",
    lastActive: formatDate(a.updatedAt),
    status: a.user?.status === "BLOCKED" ? "Blocked" : "Active",
  }));

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const blockedCount = rows.length - activeCount;

  return {
    resource: "employees",
    title: "Employees & Roles",
    description: "Manage admin team members, permissions, roles and account security.",
    search: "Search employees by name, email or phone...",
    createLabel: "Add Employee",
    drawerTitle: "Employee Details",
    metrics: buildMetrics([
      ["Total Employees", rows.length],
      ["Active Team", activeCount],
      ["Admins", rows.length],
      ["Blocked", blockedCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Blocked", count: String(blockedCount) },
    ],
    columns: [
      { key: "name", label: "Employee" },
      { key: "email", label: "Email" },
      { key: "contactNumber", label: "Phone" },
      { key: "role", label: "Role" },
      { key: "lastActive", label: "Updated" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Employee Name", value: "", required: true },
      { key: "email", label: "Email Address", value: "", required: true },
      { key: "contactNumber", label: "Contact Number", value: "" },
      { key: "role", label: "Role", value: "ADMIN", type: "select", options: ["ADMIN", "USER"] },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Blocked"] },
    ],
  };
};

// 7. RECHARGEABLE FANS
const getFansResource = async (): Promise<ResourcePayload> => {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { category: { slug: { contains: "fan", mode: "insensitive" } } },
        { category: { name: { contains: "fan", mode: "insensitive" } } },
        { name: { contains: "fan", mode: "insensitive" } },
      ],
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    brand: p.brand || "AN Electric",
    battery: p.description?.match(/(\d+\s*Hours?)/i)?.[1] || "6 Hours",
    priceNum: String(Number(p.price)),
    price: formatMoney(Number(p.price)),
    stock: String(p.stock),
    status: p.status === "ACTIVE" ? (p.stock <= (p.lowStockAt ?? 5) ? "Low Stock" : "Active") : p.status === "DRAFT" ? "Draft" : "Archived",
  }));

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const lowStockCount = rows.filter((r) => r.status === "Low Stock").length;

  return {
    resource: "fans",
    title: "Rechargeable Fans",
    description: "Manage rechargeable fan catalogue, battery specs, stock and pricing.",
    search: "Search fans by name, SKU or brand...",
    createLabel: "Add Fan",
    drawerTitle: "Rechargeable Fan Details",
    metrics: buildMetrics([
      ["Total Fans", rows.length],
      ["Active Fans", activeCount],
      ["Total Stock", products.reduce((s, p) => s + p.stock, 0)],
      ["Low Stock", lowStockCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Low Stock", count: String(lowStockCount) },
    ],
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "brand", label: "Brand" },
      { key: "battery", label: "Battery Backup" },
      { key: "price", label: "Price" },
      { key: "stock", label: "Stock" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Fan Model Name", value: "", required: true },
      { key: "sku", label: "SKU", value: "", required: true },
      { key: "brand", label: "Brand", value: "Walton" },
      { key: "battery", label: "Battery Backup (e.g. 8 Hours)", value: "6 Hours" },
      { key: "priceNum", label: "Price (৳)", value: "2450", type: "number", required: true },
      { key: "stock", label: "Stock Quantity", value: "25", type: "number", required: true },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Draft", "Archived"] },
    ],
  };
};

// 8. BRANDS
const getBrandsResource = async (): Promise<ResourcePayload> => {
  const [products, brandLogs] = await Promise.all([
    prisma.product.findMany({
      include: { orderItems: { select: { quantity: true, unitPrice: true } } },
    }),
    prisma.auditLog.findMany({
      where: { entity: "ADMIN_BRAND" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const brandStats = new Map<
    string,
    { id: string; name: string; slug: string; products: number; revenue: number; status: string }
  >();

  for (const log of brandLogs) {
    const meta = (log.metadata as any) || {};
    const name = String(meta.name || "").trim();
    if (!name) continue;
    brandStats.set(name.toLowerCase(), {
      id: log.id,
      name,
      slug: meta.slug || slugify(name),
      products: 0,
      revenue: 0,
      status: meta.status || "Active",
    });
  }

  for (const p of products) {
    const bName = (p.brand || "").trim();
    if (!bName) continue;
    const key = bName.toLowerCase();
    const itemRev = p.orderItems.reduce(
      (sum, oi) => sum + Number(oi.quantity) * Number(oi.unitPrice),
      0
    );
    const existing = brandStats.get(key);
    if (existing) {
      existing.products += 1;
      existing.revenue += itemRev;
    } else {
      brandStats.set(key, {
        id: `brand:${bName}`,
        name: bName,
        slug: slugify(bName),
        products: 1,
        revenue: itemRev,
        status: "Active",
      });
    }
  }

  const rows = Array.from(brandStats.values()).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    products: String(b.products),
    revenue: formatMoney(b.revenue),
    status: b.status,
  }));

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const inactiveCount = rows.length - activeCount;

  return {
    resource: "brands",
    title: "Brands Management",
    description: "Manage product brands, visibility and catalogue performance.",
    search: "Search brands by name or slug...",
    createLabel: "Add Brand",
    drawerTitle: "Brand Details",
    metrics: buildMetrics([
      ["Total Brands", rows.length],
      ["Active Brands", activeCount],
      ["Branded Products", products.filter((p) => Boolean(p.brand)).length],
      ["Inactive Brands", inactiveCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Inactive", count: String(inactiveCount) },
    ],
    columns: [
      { key: "name", label: "Brand" },
      { key: "slug", label: "Slug" },
      { key: "products", label: "Products" },
      { key: "revenue", label: "Revenue" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Brand Name", value: "", required: true },
      { key: "slug", label: "Slug", value: "" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Inactive"] },
    ],
  };
};

// 9. WHOLESALE / PAIKARI
const getWholesaleResource = async (): Promise<ResourcePayload> => {
  const [wholesaleLogs, wholesaleProducts] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "ADMIN_WHOLESALE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { isWholesale: true },
      include: { orderItems: { select: { quantity: true, unitPrice: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const logRows = wholesaleLogs.map((log) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      name: meta.name || "Wholesale Partner",
      contact: meta.contact || "—",
      orders: String(meta.orders || "1"),
      amountNum: String(parseNum(meta.amountNum ?? meta.amount, 0)),
      amount: formatMoney(parseNum(meta.amountNum ?? meta.amount, 0)),
      tier: meta.tier || "Gold",
      status: meta.status || "Approved",
    };
  });

  const productRows = wholesaleProducts.map((p) => {
    const rev = p.orderItems.reduce(
      (sum, oi) => sum + Number(oi.quantity) * Number(oi.unitPrice),
      0
    );
    return {
      id: `prod:${p.id}`,
      name: `${p.name} (Min ${p.minWholesaleQty} pcs)`,
      contact: `SKU: ${p.sku}`,
      orders: String(p.orderItems.length),
      amountNum: String(Number(p.price)),
      amount: formatMoney(rev || Number(p.price) * p.minWholesaleQty),
      tier: "Wholesale SKU",
      status: p.status === "ACTIVE" ? "Approved" : "Pending",
    };
  });

  const rows = [...logRows, ...productRows];
  const approvedCount = rows.filter((r) => r.status === "Approved").length;
  const pendingCount = rows.length - approvedCount;

  return {
    resource: "wholesale",
    title: "Wholesale / Paikari",
    description: "Review dealer accounts, wholesale products, price tiers and approvals.",
    search: "Search dealers, businesses or wholesale SKUs...",
    createLabel: "Add Wholesale Account",
    drawerTitle: "Wholesale Account Details",
    metrics: buildMetrics([
      ["Wholesale Entries", rows.length],
      ["Approved", approvedCount],
      ["Wholesale Products", wholesaleProducts.length],
      ["Pending Review", pendingCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Approved", count: String(approvedCount) },
      { label: "Pending", count: String(pendingCount) },
    ],
    columns: [
      { key: "name", label: "Business / Item" },
      { key: "contact", label: "Contact / SKU" },
      { key: "orders", label: "Orders" },
      { key: "amount", label: "Value" },
      { key: "tier", label: "Price Tier" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Business / Dealer Name", value: "", required: true },
      { key: "contact", label: "Phone / Contact", value: "", required: true },
      { key: "orders", label: "Total Orders", value: "1", type: "number" },
      { key: "amountNum", label: "Account Value (৳)", value: "50000", type: "number" },
      { key: "tier", label: "Price Tier", value: "Gold", type: "select", options: ["Platinum", "Gold", "Silver", "Dealer"] },
      { key: "status", label: "Status", value: "Approved", type: "select", options: ["Approved", "Pending", "Blocked"] },
    ],
  };
};

// 10. BANNERS & SLIDERS
const getBannersResource = async (): Promise<ResourcePayload> => {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "ADMIN_BANNER" },
    orderBy: { createdAt: "desc" },
  });

  const rows = logs.map((log, idx) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      name: meta.name || "Promotional Banner", image: meta.image || "",
      subtitle: meta.subtitle || "",
      type: meta.type || "Homepage",
      target: meta.target || "/products",
      range: meta.range || formatDate(log.createdAt),
      status: meta.status || "Active",
      order: String(meta.order || idx + 1),
      views: String(meta.views || "0"),
    };
  });

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const scheduledCount = rows.filter((r) => r.status === "Scheduled").length;
  const inactiveCount = rows.filter((r) => r.status === "Inactive").length;

  return {
    resource: "banners",
    title: "Banners & Sliders",
    description: "Manage homepage banners, promotional sliders and marketing creatives.",
    search: "Search banners by title, placement or link...",
    createLabel: "Add Banner",
    drawerTitle: "Banner Details",
    metrics: buildMetrics([
      ["Total Banners", rows.length],
      ["Active Banners", activeCount],
      ["Scheduled", scheduledCount],
      ["Inactive", inactiveCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Scheduled", count: String(scheduledCount) },
      { label: "Inactive", count: String(inactiveCount) },
    ],
    columns: [
      { key: "name", label: "Banner Title" },
      { key: "type", label: "Placement" },
      { key: "target", label: "Target URL" },
      { key: "range", label: "Date Range" },
      { key: "order", label: "Sort Order" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Banner Title", value: "", required: true },
      { key: "subtitle", label: "Subtitle", value: "" },
      { key: "type", label: "Banner Placement", value: "Homepage", type: "select", options: ["Homepage", "Category", "Popup", "Wholesale"] },
      { key: "target", label: "Target Link URL", value: "/products", required: true },
      { key: "range", label: "Campaign Date Range", value: "Ongoing" },
      { key: "order", label: "Sort Order", value: "1", type: "number" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Scheduled", "Inactive"] },
    ],
    showcase: rows.slice(0, 4).map((r, idx) => ({
      name: r.name,
      meta: `${r.type} · ${r.status}`,
      tone: tones[idx % tones.length],
    })),
  };
};

// 11. REPORTS & ANALYTICS
const getReportsResource = async (): Promise<ResourcePayload> => {
  const [reportLogs, orderAgg, productCount, customerCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "ADMIN_REPORT" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      _count: { id: true },
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.product.count(),
    prisma.user.count({ where: { role: "USER", isDeleted: false } }),
  ]);

  const totalRev = Number(orderAgg._sum.total) || 0;
  const totalOrders = orderAgg._count.id || 0;

  const rows = reportLogs.map((log) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      name: meta.name || "Analytics Report",
      scope: meta.scope || "Sales",
      period: meta.period || "Current Month",
      owner: meta.owner || "Admin",
      summary: meta.summary || `${totalOrders} orders · ${formatMoney(totalRev)}`,
      updated: formatDate(log.createdAt),
      status: meta.status || "Ready",
    };
  });

  const readyCount = rows.filter((r) => r.status === "Ready").length;
  const processingCount = rows.length - readyCount;

  return {
    resource: "reports",
    title: "Reports & Analytics",
    description: "Generate and manage sales, inventory, customer and financial reports.",
    search: "Search reports by title, scope or owner...",
    createLabel: "Generate Report",
    drawerTitle: "Report Details",
    metrics: buildMetrics([
      ["Saved Reports", rows.length],
      ["Live Revenue", formatMoney(totalRev)],
      ["Live Products", productCount],
      ["Live Customers", customerCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Ready", count: String(readyCount) },
      { label: "Processing", count: String(processingCount) },
    ],
    columns: [
      { key: "name", label: "Report Name" },
      { key: "scope", label: "Scope" },
      { key: "period", label: "Period" },
      { key: "summary", label: "Live Snapshot" },
      { key: "owner", label: "Owner" },
      { key: "updated", label: "Generated On" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Report Name", value: "", required: true },
      { key: "scope", label: "Scope", value: "Sales", type: "select", options: ["Sales", "Inventory", "Customers", "Finance"] },
      { key: "period", label: "Period", value: "This Month" },
      { key: "owner", label: "Owner / Department", value: "Finance" },
      { key: "status", label: "Status", value: "Ready", type: "select", options: ["Ready", "Processing", "Archived"] },
    ],
  };
};

// 12. MARKETING CAMPAIGNS
const getMarketingResource = async (): Promise<ResourcePayload> => {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "ADMIN_MARKETING" },
    orderBy: { createdAt: "desc" },
  });

  const rows = logs.map((log) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      name: meta.name || "Campaign",
      channel: meta.channel || "Facebook",
      audience: String(meta.audience || "All Customers"),
      budgetNum: String(parseNum(meta.budgetNum ?? meta.budget, 0)),
      budget: formatMoney(parseNum(meta.budgetNum ?? meta.budget, 0)),
      conversion: String(meta.conversion || "0%"),
      status: meta.status || "Active",
    };
  });

  const activeCount = rows.filter((r) => r.status === "Active").length;
  const scheduledCount = rows.filter((r) => r.status !== "Active").length;
  const totalBudget = rows.reduce((sum, r) => sum + parseNum(r.budgetNum, 0), 0);

  return {
    resource: "marketing",
    title: "Marketing Campaigns",
    description: "Plan campaigns, audience segments, channels and conversion performance.",
    search: "Search campaigns by name, channel or status...",
    createLabel: "Create Campaign",
    drawerTitle: "Campaign Details",
    metrics: buildMetrics([
      ["Total Campaigns", rows.length],
      ["Active Campaigns", activeCount],
      ["Total Budget", formatMoney(totalBudget)],
      ["Scheduled / Paused", scheduledCount],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Scheduled", count: String(scheduledCount) },
    ],
    columns: [
      { key: "name", label: "Campaign" },
      { key: "channel", label: "Channel" },
      { key: "audience", label: "Audience" },
      { key: "budget", label: "Budget" },
      { key: "conversion", label: "Conversion" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Campaign Name", value: "", required: true },
      { key: "channel", label: "Channel", value: "Facebook", type: "select", options: ["Facebook", "Email", "SMS", "Google Ads", "Instagram"] },
      { key: "audience", label: "Target Audience", value: "All Customers" },
      { key: "budgetNum", label: "Budget (৳)", value: "10000", type: "number", required: true },
      { key: "conversion", label: "Conversion Rate", value: "5.0%" },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Scheduled", "Paused", "Completed"] },
    ],
  };
};

// 13. STORE SETTINGS
const getSettingsResource = async (): Promise<ResourcePayload> => {
  const [shippingZones, taxRules, settingLogs] = await Promise.all([
    prisma.shippingZone.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.taxRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({
      where: { entity: "ADMIN_SETTING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const zoneRows = shippingZones.map((z) => ({
    id: `zone:${z.id}`,
    name: `Shipping: ${z.name}`,
    description: `Cities: ${z.cities.join(", ") || "All"} · Fee: ${formatMoney(Number(z.deliveryFee))}`,
    value: String(Number(z.deliveryFee)),
    owner: "Operations",
    updated: formatDate(z.updatedAt),
    status: z.isActive ? "Active" : "Inactive",
  }));

  const taxRows = taxRules.map((t) => ({
    id: `tax:${t.id}`,
    name: `Tax: ${t.name} (${t.code})`,
    description: `Rate: ${Number(t.rate)}%`,
    value: `${Number(t.rate)}%`,
    owner: "Finance",
    updated: formatDate(t.updatedAt),
    status: t.isActive ? "Active" : "Inactive",
  }));

  const customRows = settingLogs.map((log) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      name: meta.name || "Store Configuration",
      description: meta.description || "—",
      value: meta.value || "",
      owner: meta.owner || "Admin",
      updated: formatDate(log.createdAt),
      status: meta.status || "Active",
    };
  });

  const rows = [...customRows, ...zoneRows, ...taxRows];
  const activeCount = rows.filter((r) => r.status === "Active" || r.status === "Configured").length;
  const inactiveCount = rows.length - activeCount;

  return {
    resource: "settings",
    title: "Store Settings",
    description: "Configure store identity, shipping zones, tax rules, payments and notifications.",
    search: "Search settings, shipping zones or tax rules...",
    createLabel: "Add Setting",
    drawerTitle: "Setting Details",
    metrics: buildMetrics([
      ["Total Configurations", rows.length],
      ["Active Settings", activeCount],
      ["Shipping Zones", shippingZones.length],
      ["Tax Rules", taxRules.length],
    ]),
    tabs: [
      { label: "All", count: String(rows.length) },
      { label: "Active", count: String(activeCount) },
      { label: "Inactive", count: String(inactiveCount) },
    ],
    columns: [
      { key: "name", label: "Setting / Policy" },
      { key: "description", label: "Configuration Details" },
      { key: "owner", label: "Owner" },
      { key: "updated", label: "Last Updated" },
      { key: "status", label: "Status" },
    ],
    rows,
    fields: [
      { key: "name", label: "Setting Name", value: "", required: true },
      { key: "description", label: "Configuration Value / Details", value: "", type: "textarea", required: true },
      { key: "owner", label: "Owner Department", value: "Admin", type: "select", options: ["Admin", "Finance", "Operations", "Support"] },
      { key: "status", label: "Status", value: "Active", type: "select", options: ["Active", "Inactive"] },
    ],
  };
};

const getResource = async (resource: string): Promise<ResourcePayload> => {
  switch (resource) {
    case "categories":
      return getCategoriesResource();
    case "inventory":
      return getInventoryResource();
    case "customers":
      return getCustomersResource();
    case "coupons":
      return getCouponsResource();
    case "reviews":
      return getReviewsResource();
    case "employees":
      return getEmployeesResource();
    case "fans":
    case "rechargeable-fans":
      return getFansResource();
    case "brands":
      return getBrandsResource();
    case "wholesale":
      return getWholesaleResource();
    case "banners":
      return getBannersResource();
    case "reports":
      return getReportsResource();
    case "marketing":
      return getMarketingResource();
    case "settings":
      return getSettingsResource();
    default:
      throw new AppError(status.NOT_FOUND, `Unknown admin resource: ${resource}`);
  }
};

// CREATE RESOURCE ITEM
const createResourceItem = async (resource: string, data: Record<string, any>, actorId?: string) => {
  switch (resource) {
    case "categories": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Category name is required");
      const slug = slugify(data.slug || name);
      const isActive = String(data.status || "Active").toLowerCase() !== "inactive";
      await prisma.category.create({
        data: {
          name,
          slug,
          description: data.description || null,
          image: data.image || null,
          isActive,
        },
      });
      return getCategoriesResource();
    }

    case "inventory": {
      const name = String(data.name || "").trim();
      const sku = String(data.sku || `AN-${Date.now().toString().slice(-5)}`).trim();
      const stock = Math.max(0, Math.round(parseNum(data.stock, 0)));
      const lowStockAt = Math.max(0, Math.round(parseNum(data.lowStockAt, 5)));
      const price = Math.max(1, parseNum(data.price, 1000));
      const warehouseName = String(data.warehouse || "Dhaka Central").trim();

      if (!name) throw new AppError(status.BAD_REQUEST, "Product name is required");

      await prisma.$transaction(async (tx) => {
        const whCode = slugify(warehouseName).toUpperCase().slice(0, 16) || "WH-MAIN";
        const warehouse = await tx.warehouse.upsert({
          where: { code: whCode },
          update: { name: warehouseName },
          create: { name: warehouseName, code: whCode, isActive: true },
        });

        let product = await tx.product.findFirst({
          where: { OR: [{ sku }, { name: { equals: name, mode: "insensitive" } }] },
          include: { variants: true },
        });

        if (!product) {
          let category = await tx.category.findFirst();
          if (!category) {
            category = await tx.category.create({
              data: { name: "General", slug: "general", isActive: true },
            });
          }
          product = await tx.product.create({
            data: {
              name,
              slug: `${slugify(name)}-${Date.now().toString().slice(-4)}`,
              sku,
              price,
              stock,
              lowStockAt,
              status: "ACTIVE",
              categoryId: category.id,
              images: [],
            },
            include: { variants: true },
          });
        } else {
          product = await tx.product.update({
            where: { id: product.id },
            data: { stock, lowStockAt },
            include: { variants: true },
          });
        }

        let variant = product.variants[0];
        if (!variant) {
          variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              name: "Standard",
              sku: `${product.sku}-STD`,
              attributes: { type: "Standard" },
              price: product.price,
              stock,
              lowStockAt,
              isActive: true,
            },
          });
        }

        await tx.inventoryTransaction.create({
          data: {
            variantId: variant.id,
            warehouseId: warehouse.id,
            type: "ADJUSTMENT",
            quantity: stock,
            previousStock: 0,
            newStock: stock,
            reason: "Admin inventory entry",
          },
        });
      });

      return getInventoryResource();
    }

    case "customers": {
      const name = String(data.name || "").trim();
      const email = String(data.email || "").trim().toLowerCase();
      if (!name || !email) {
        throw new AppError(status.BAD_REQUEST, "Customer name and email are required");
      }
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError(status.CONFLICT, "A user with this email already exists");
      }
      const userStat =
        String(data.status || "Active").toLowerCase() === "blocked"
          ? userStatus.BLOCKED
          : userStatus.ACTIVE;

      await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            id: randomUUID(),
            name,
            email,
            role: Role.USER,
            status: userStat,
            emailVerified: true,
          },
        });
        await tx.address.create({
          data: {
            userId: createdUser.id,
            label: "Primary",
            recipientName: name,
            phone: String(data.phone || "01700-000000").trim(),
            city: String(data.location || "Dhaka").trim(),
            addressLine: String(data.addressLine || data.location || "Dhaka").trim(),
            isDefault: true,
          },
        });
      });

      return getCustomersResource();
    }

    case "coupons": {
      const code = String(data.code || "").trim().toUpperCase();
      if (!code) throw new AppError(status.BAD_REQUEST, "Coupon code is required");
      const existing = await prisma.coupon.findUnique({ where: { code } });
      if (existing) throw new AppError(status.CONFLICT, "Coupon code already exists");

      const discountType = String(data.type || "Percentage").toLowerCase().includes("fix")
        ? DiscountType.FIXED
        : DiscountType.PERCENTAGE;
      const value = Math.max(1, parseNum(data.discountValue ?? data.discount, 10));
      const minimumOrder = parseNum(data.minimumOrder ?? data.minimum, 0);
      const usageLimit = parseCouponUsageLimit(data.usageLimit, data.usage, 100);
      const expiresAt = parseCouponExpiry(data.expiresAt ?? data.validity);
      const isActive = String(data.status || "Active").toLowerCase() !== "inactive";

      const created = await prisma.coupon.create({
        data: {
          code,
          type: discountType,
          value,
          minimumOrder,
          usageLimit,
          expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
          isActive,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "COUPON_META",
          entityId: created.id,
          metadata: {
            name: String(data.name || `${code} Offer`).trim(),
            description: String(data.description || "").trim(),
          },
        },
      });

      return getCouponsResource();
    }

    case "reviews": {
      const customerInput = String(data.name || "Customer").trim();
      const productInput = String(data.product || "").trim();
      const rating = Math.max(1, Math.min(5, Math.round(parseNum(data.ratingNum ?? data.rating, 5))));
      const comment = String(data.content || "").trim();
      const isPublished = String(data.status || "Approved").toLowerCase() !== "pending";

      let product = await prisma.product.findFirst({
        where: productInput
          ? {
              OR: [
                { id: productInput },
                { sku: { equals: productInput, mode: "insensitive" } },
                { name: { contains: productInput, mode: "insensitive" } },
              ],
            }
          : {},
      });

      if (!product) {
        product = await prisma.product.findFirst();
      }
      if (!product) {
        let cat = await prisma.category.findFirst();
        if (!cat) {
          cat = await prisma.category.create({
            data: { name: "General", slug: "general", isActive: true },
          });
        }
        product = await prisma.product.create({
          data: {
            name: productInput || "Featured Store Product",
            slug: `${slugify(productInput || "featured-product")}-${Date.now().toString().slice(-4)}`,
            sku: `AN-${Date.now().toString().slice(-5)}`,
            price: 1000,
            stock: 20,
            status: "ACTIVE",
            categoryId: cat.id,
            images: [],
          },
        });
      }

      const email = customerInput.includes("@")
        ? customerInput.toLowerCase()
        : `${slugify(customerInput)}.${Date.now().toString().slice(-4)}@customer.local`;

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { name: { equals: customerInput, mode: "insensitive" } },
          ],
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: randomUUID(),
            name: customerInput,
            email,
            role: Role.USER,
            status: "ACTIVE",
            emailVerified: true,
          },
        });
      }

      await prisma.review.upsert({
        where: { userId_productId: { userId: user.id, productId: product.id } },
        update: { rating, comment, isPublished },
        create: { userId: user.id, productId: product.id, rating, comment, isPublished },
      });

      return getReviewsResource();
    }

    case "employees": {
      const name = String(data.name || "").trim();
      const email = String(data.email || "").trim().toLowerCase();
      if (!name || !email) {
        throw new AppError(status.BAD_REQUEST, "Employee name and email are required");
      }

      const roleValue = String(data.role || "ADMIN").toUpperCase() === "USER" ? Role.USER : Role.ADMIN;
      const statusValue =
        String(data.status || "Active").toLowerCase() === "blocked"
          ? userStatus.BLOCKED
          : userStatus.ACTIVE;

      await prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          user = await tx.user.create({
            data: {
              id: randomUUID(),
              name,
              email,
              role: roleValue,
              status: statusValue,
              emailVerified: true,
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: { name, role: roleValue, status: statusValue, isDeleted: false },
          });
        }

        await tx.admin.upsert({
          where: { email },
          update: {
            name,
            contactNumber: data.contactNumber || null,
            isDeleted: false,
          },
          create: {
            name,
            email,
            contactNumber: data.contactNumber || null,
            userId: user.id,
          },
        });
      });

      return getEmployeesResource();
    }

    case "fans":
    case "rechargeable-fans": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Fan name is required");
      const sku = String(data.sku || `AN-FAN-${Date.now().toString().slice(-4)}`).trim();
      const price = Math.max(1, parseNum(data.priceNum ?? data.price, 2450));
      const stock = Math.max(0, Math.round(parseNum(data.stock, 20)));
      const brand = String(data.brand || "Walton").trim();
      const battery = String(data.battery || "6 Hours").trim();
      const statusRaw = String(data.status || "Active").toUpperCase();
      const prodStatus =
        statusRaw === "DRAFT" ? "DRAFT" : statusRaw === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

      const fanCategory = await prisma.category.upsert({
        where: { slug: "rechargeable-fans" },
        update: { isActive: true },
        create: {
          name: "Rechargeable Fans",
          slug: "rechargeable-fans",
          description: "Rechargeable table, stand and mini fans",
          isActive: true,
        },
      });

      await prisma.product.create({
        data: {
          name,
          slug: `${slugify(name)}-${Date.now().toString().slice(-4)}`,
          sku: `${sku}-${Date.now().toString().slice(-3)}`,
          brand,
          description: `Battery backup: ${battery}`,
          price,
          stock,
          status: prodStatus,
          categoryId: fanCategory.id,
          images: [],
        },
      });

      return getFansResource();
    }

    case "brands": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Brand name is required");
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_BRAND",
          metadata: {
            name,
            slug: data.slug ? slugify(data.slug) : slugify(name),
            status: data.status || "Active",
          },
        },
      });
      return getBrandsResource();
    }

    case "wholesale": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Business name is required");
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_WHOLESALE",
          metadata: {
            name,
            contact: data.contact || "—",
            orders: String(parseNum(data.orders, 1)),
            amountNum: parseNum(data.amountNum ?? data.amount, 0),
            tier: data.tier || "Gold",
            status: data.status || "Approved",
          },
        },
      });
      return getWholesaleResource();
    }

    case "banners": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Banner title is required");
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_BANNER",
          metadata: {
            name,
            subtitle: data.subtitle || "", image: data.image || "",
            type: data.type || "Homepage",
            target: data.target || "/products",
            range: data.range || "Ongoing",
            order: String(parseNum(data.order, 1)),
            views: String(parseNum(data.views, 0)),
            status: data.status || "Active",
          },
        },
      });
      return getBannersResource();
    }

    case "reports": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Report name is required");
      const [orderAgg, prodCount] = await Promise.all([
        prisma.order.aggregate({ _sum: { total: true }, _count: { id: true } }),
        prisma.product.count(),
      ]);
      const summary = `${orderAgg._count.id} orders · ${formatMoney(Number(orderAgg._sum.total) || 0)} · ${prodCount} SKUs`;

      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_REPORT",
          metadata: {
            name,
            scope: data.scope || "Sales",
            period: data.period || "Current Month",
            owner: data.owner || "Finance",
            summary,
            status: data.status || "Ready",
          },
        },
      });
      return getReportsResource();
    }

    case "marketing": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Campaign name is required");
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_MARKETING",
          metadata: {
            name,
            channel: data.channel || "Facebook",
            audience: data.audience || "All Customers",
            budgetNum: parseNum(data.budgetNum ?? data.budget, 0),
            conversion: data.conversion || "5.0%",
            status: data.status || "Active",
          },
        },
      });
      return getMarketingResource();
    }

    case "settings": {
      const name = String(data.name || "").trim();
      if (!name) throw new AppError(status.BAD_REQUEST, "Setting name is required");
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "CREATE",
          entity: "ADMIN_SETTING",
          metadata: {
            name,
            description: data.description || "",
            owner: data.owner || "Admin",
            status: data.status || "Active",
          },
        },
      });
      return getSettingsResource();
    }

    default:
      throw new AppError(status.BAD_REQUEST, `Unsupported resource: ${resource}`);
  }
};

// UPDATE RESOURCE ITEM
const updateResourceItem = async (
  resource: string,
  id: string,
  data: Record<string, any>
) => {
  switch (resource) {
    case "categories": {
      const isActive =
        data.status !== undefined
          ? String(data.status).toLowerCase() !== "inactive"
          : undefined;
      await prisma.category.update({
        where: { id },
        data: {
          ...(data.name ? { name: String(data.name).trim() } : {}),
          ...(data.slug ? { slug: slugify(String(data.slug)) } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.image !== undefined ? { image: data.image || null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      return getCategoriesResource();
    }

    case "inventory": {
      const stock = data.stock !== undefined ? Math.max(0, Math.round(parseNum(data.stock, 0))) : undefined;
      const lowStockAt =
        data.lowStockAt !== undefined ? Math.max(0, Math.round(parseNum(data.lowStockAt, 5))) : undefined;
      const price = data.price !== undefined ? Math.max(0, parseNum(data.price, 0)) : undefined;

      await prisma.product.update({
        where: { id },
        data: {
          ...(data.name ? { name: String(data.name).trim() } : {}),
          ...(data.sku ? { sku: String(data.sku).trim() } : {}),
          ...(stock !== undefined ? { stock } : {}),
          ...(lowStockAt !== undefined ? { lowStockAt } : {}),
          ...(price !== undefined && price > 0 ? { price } : {}),
        },
      });
      return getInventoryResource();
    }

    case "customers": {
      const statusVal =
        data.status !== undefined
          ? String(data.status).toLowerCase() === "blocked"
            ? userStatus.BLOCKED
            : userStatus.ACTIVE
          : undefined;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            ...(data.name ? { name: String(data.name).trim() } : {}),
            ...(data.email ? { email: String(data.email).trim().toLowerCase() } : {}),
            ...(statusVal ? { status: statusVal } : {}),
          },
        });

        const existingAddr = await tx.address.findFirst({
          where: { userId: id },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });

        if (existingAddr) {
          await tx.address.update({
            where: { id: existingAddr.id },
            data: {
              ...(data.name ? { recipientName: String(data.name).trim() } : {}),
              ...(data.phone ? { phone: String(data.phone).trim() } : {}),
              ...(data.location ? { city: String(data.location).trim() } : {}),
              ...(data.addressLine !== undefined ? { addressLine: String(data.addressLine).trim() } : {}),
            },
          });
        } else if (data.phone || data.location || data.addressLine) {
          await tx.address.create({
            data: {
              userId: id,
              label: "Primary",
              recipientName: String(data.name || "Customer").trim(),
              phone: String(data.phone || "01700-000000").trim(),
              city: String(data.location || "Dhaka").trim(),
              addressLine: String(data.addressLine || data.location || "Dhaka").trim(),
              isDefault: true,
            },
          });
        }
      });

      return getCustomersResource();
    }

    case "coupons": {
      const discountType =
        data.type !== undefined
          ? String(data.type).toLowerCase().includes("fix")
            ? DiscountType.FIXED
            : DiscountType.PERCENTAGE
          : undefined;
      const value =
        data.discountValue !== undefined || data.discount !== undefined
          ? Math.max(1, parseNum(data.discountValue ?? data.discount, 10))
          : undefined;
      const minimumOrder =
        data.minimumOrder !== undefined || data.minimum !== undefined
          ? parseNum(data.minimumOrder ?? data.minimum, 0)
          : undefined;
      const usageLimit =
        data.usageLimit !== undefined || data.usage !== undefined
          ? parseCouponUsageLimit(data.usageLimit, data.usage, 100)
          : undefined;
      const isActive =
        data.status !== undefined
          ? String(data.status).toLowerCase() !== "inactive" &&
            String(data.status).toLowerCase() !== "expired"
          : undefined;

      await prisma.coupon.update({
        where: { id },
        data: {
          ...(data.code ? { code: String(data.code).trim().toUpperCase() } : {}),
          ...(discountType ? { type: discountType } : {}),
          ...(value !== undefined ? { value } : {}),
          ...(minimumOrder !== undefined ? { minimumOrder } : {}),
          ...(usageLimit !== undefined ? { usageLimit } : {}),
          ...(data.expiresAt !== undefined || data.validity !== undefined ? { expiresAt: parseCouponExpiry(data.expiresAt ?? data.validity) } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      if (data.name !== undefined || data.description !== undefined) {
        const metaLog = await prisma.auditLog.findFirst({
          where: { entity: "COUPON_META", entityId: id },
        });
        if (metaLog) {
          const prev = (metaLog.metadata as any) || {};
          await prisma.auditLog.update({
            where: { id: metaLog.id },
            data: {
              metadata: {
                ...prev,
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
              },
            },
          });
        } else {
          await prisma.auditLog.create({
            data: {
              action: "UPDATE",
              entity: "COUPON_META",
              entityId: id,
              metadata: { name: data.name || "", description: data.description || "" },
            },
          });
        }
      }

      return getCouponsResource();
    }

    case "reviews": {
      const rating =
        data.ratingNum !== undefined || data.rating !== undefined
          ? Math.max(1, Math.min(5, Math.round(parseNum(data.ratingNum ?? data.rating, 5))))
          : undefined;
      const isPublished =
        data.status !== undefined
          ? String(data.status).toLowerCase() === "approved"
          : undefined;

      await prisma.review.update({
        where: { id },
        data: {
          ...(rating !== undefined ? { rating } : {}),
          ...(data.content !== undefined ? { comment: String(data.content) } : {}),
          ...(isPublished !== undefined ? { isPublished } : {}),
        },
      });
      return getReviewsResource();
    }

    case "employees": {
      const admin = await prisma.admin.findUnique({ where: { id } });
      if (!admin) throw new AppError(status.NOT_FOUND, "Employee not found");

      const statusVal =
        data.status !== undefined
          ? String(data.status).toLowerCase() === "blocked"
            ? userStatus.BLOCKED
            : userStatus.ACTIVE
          : undefined;
      const roleVal =
        data.role !== undefined
          ? String(data.role).toUpperCase() === "USER"
            ? Role.USER
            : Role.ADMIN
          : undefined;

      await prisma.$transaction(async (tx) => {
        await tx.admin.update({
          where: { id },
          data: {
            ...(data.name ? { name: String(data.name).trim() } : {}),
            ...(data.email ? { email: String(data.email).trim().toLowerCase() } : {}),
            ...(data.contactNumber !== undefined ? { contactNumber: data.contactNumber } : {}),
          },
        });
        await tx.user.update({
          where: { id: admin.userId },
          data: {
            ...(data.name ? { name: String(data.name).trim() } : {}),
            ...(data.email ? { email: String(data.email).trim().toLowerCase() } : {}),
            ...(statusVal ? { status: statusVal } : {}),
            ...(roleVal ? { role: roleVal } : {}),
          },
        });
      });

      return getEmployeesResource();
    }

    case "fans":
    case "rechargeable-fans": {
      const price =
        data.priceNum !== undefined || data.price !== undefined
          ? Math.max(1, parseNum(data.priceNum ?? data.price, 2450))
          : undefined;
      const stock =
        data.stock !== undefined ? Math.max(0, Math.round(parseNum(data.stock, 0))) : undefined;
      const prodStatus =
        data.status !== undefined
          ? String(data.status).toUpperCase() === "DRAFT"
            ? "DRAFT"
            : String(data.status).toUpperCase() === "ARCHIVED"
            ? "ARCHIVED"
            : "ACTIVE"
          : undefined;

      await prisma.product.update({
        where: { id },
        data: {
          ...(data.name ? { name: String(data.name).trim() } : {}),
          ...(data.sku ? { sku: String(data.sku).trim() } : {}),
          ...(data.brand ? { brand: String(data.brand).trim() } : {}),
          ...(data.battery ? { description: `Battery backup: ${data.battery}` } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(stock !== undefined ? { stock } : {}),
          ...(prodStatus ? { status: prodStatus as any } : {}),
        },
      });
      return getFansResource();
    }

    case "brands": {
      if (id.startsWith("brand:")) {
        const oldBrand = id.replace(/^brand:/, "");
        const newBrand = String(data.name || oldBrand).trim();
        if (newBrand !== oldBrand) {
          await prisma.product.updateMany({
            where: { brand: oldBrand },
            data: { brand: newBrand },
          });
        }
        await prisma.auditLog.create({
          data: {
            action: "UPDATE",
            entity: "ADMIN_BRAND",
            metadata: {
              name: newBrand,
              slug: slugify(data.slug || newBrand),
              status: data.status || "Active",
            },
          },
        });
      } else {
        const log = await prisma.auditLog.findUnique({ where: { id } });
        if (log) {
          const prev = (log.metadata as any) || {};
          const newName = String(data.name || prev.name || "").trim();
          if (prev.name && newName && prev.name !== newName) {
            await prisma.product.updateMany({
              where: { brand: prev.name },
              data: { brand: newName },
            });
          }
          await prisma.auditLog.update({
            where: { id },
            data: {
              metadata: {
                ...prev,
                ...data,
                name: newName,
                slug: slugify(data.slug || newName),
              },
            },
          });
        }
      }
      return getBrandsResource();
    }

    case "wholesale": {
      if (id.startsWith("prod:")) {
        const prodId = id.replace(/^prod:/, "");
        await prisma.product.update({
          where: { id: prodId },
          data: {
            ...(data.name ? { name: String(data.name).replace(/\s*\(Min.*\)$/i, "").trim() } : {}),
            ...(data.amountNum || data.amount
              ? { price: Math.max(1, parseNum(data.amountNum ?? data.amount, 1000)) }
              : {}),
            ...(data.status
              ? { status: String(data.status).toLowerCase() === "approved" ? "ACTIVE" : "DRAFT" }
              : {}),
          },
        });
      } else {
        const log = await prisma.auditLog.findUnique({ where: { id } });
        if (log) {
          const prev = (log.metadata as any) || {};
          await prisma.auditLog.update({
            where: { id },
            data: {
              metadata: {
                ...prev,
                ...data,
                amountNum: parseNum(data.amountNum ?? data.amount ?? prev.amountNum, 0),
              },
            },
          });
        }
      }
      return getWholesaleResource();
    }

    case "banners":
    case "reports":
    case "marketing": {
      const log = await prisma.auditLog.findUnique({ where: { id } });
      if (!log) throw new AppError(status.NOT_FOUND, "Record not found");
      const prev = (log.metadata as any) || {};
      await prisma.auditLog.update({
        where: { id },
        data: {
          metadata: {
            ...prev,
            ...data,
          },
        },
      });
      return getResource(resource);
    }

    case "settings": {
      if (id.startsWith("zone:")) {
        const zoneId = id.replace(/^zone:/, "");
        await prisma.shippingZone.update({
          where: { id: zoneId },
          data: {
            ...(data.name ? { name: String(data.name).replace(/^Shipping:\s*/i, "").trim() } : {}),
            ...(data.status !== undefined
              ? { isActive: String(data.status).toLowerCase() === "active" }
              : {}),
          },
        });
      } else if (id.startsWith("tax:")) {
        const taxId = id.replace(/^tax:/, "");
        await prisma.taxRule.update({
          where: { id: taxId },
          data: {
            ...(data.name ? { name: String(data.name).replace(/^Tax:\s*/i, "").trim() } : {}),
            ...(data.status !== undefined
              ? { isActive: String(data.status).toLowerCase() === "active" }
              : {}),
          },
        });
      } else {
        const log = await prisma.auditLog.findUnique({ where: { id } });
        if (log) {
          const prev = (log.metadata as any) || {};
          await prisma.auditLog.update({
            where: { id },
            data: { metadata: { ...prev, ...data } },
          });
        }
      }
      return getSettingsResource();
    }

    default:
      throw new AppError(status.BAD_REQUEST, `Unsupported resource: ${resource}`);
  }
};

// TOGGLE STATUS
const toggleResourceStatus = async (resource: string, id: string) => {
  switch (resource) {
    case "categories": {
      const cat = await prisma.category.findUniqueOrThrow({ where: { id } });
      await prisma.category.update({ where: { id }, data: { isActive: !cat.isActive } });
      return getCategoriesResource();
    }
    case "inventory": {
      const prod = await prisma.product.findUniqueOrThrow({ where: { id } });
      const nextStock = prod.stock <= (prod.lowStockAt ?? 5) ? Math.max(25, (prod.lowStockAt ?? 5) + 20) : 0;
      await prisma.product.update({ where: { id }, data: { stock: nextStock } });
      return getInventoryResource();
    }
    case "customers": {
      const u = await prisma.user.findUniqueOrThrow({ where: { id } });
      const nextStatus = u.status === "ACTIVE" ? userStatus.BLOCKED : userStatus.ACTIVE;
      await prisma.user.update({ where: { id }, data: { status: nextStatus } });
      return getCustomersResource();
    }
    case "coupons": {
      const c = await prisma.coupon.findUniqueOrThrow({ where: { id } });
      await prisma.coupon.update({ where: { id }, data: { isActive: !c.isActive } });
      return getCouponsResource();
    }
    case "reviews": {
      const r = await prisma.review.findUniqueOrThrow({ where: { id } });
      await prisma.review.update({ where: { id }, data: { isPublished: !r.isPublished } });
      return getReviewsResource();
    }
    case "employees": {
      const a = await prisma.admin.findUniqueOrThrow({ where: { id }, include: { user: true } });
      const nextStatus = a.user.status === "ACTIVE" ? userStatus.BLOCKED : userStatus.ACTIVE;
      await prisma.user.update({ where: { id: a.userId }, data: { status: nextStatus } });
      return getEmployeesResource();
    }
    case "fans":
    case "rechargeable-fans": {
      const p = await prisma.product.findUniqueOrThrow({ where: { id } });
      const nextStatus = p.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
      await prisma.product.update({ where: { id }, data: { status: nextStatus } });
      return getFansResource();
    }
    case "brands": {
      if (id.startsWith("brand:")) {
        const bName = id.replace(/^brand:/, "");
        await prisma.auditLog.create({
          data: {
            action: "UPDATE",
            entity: "ADMIN_BRAND",
            metadata: { name: bName, slug: slugify(bName), status: "Inactive" },
          },
        });
      } else {
        const log = await prisma.auditLog.findUniqueOrThrow({ where: { id } });
        const meta = (log.metadata as any) || {};
        const nextStatus = meta.status === "Inactive" ? "Active" : "Inactive";
        await prisma.auditLog.update({
          where: { id },
          data: { metadata: { ...meta, status: nextStatus } },
        });
      }
      return getBrandsResource();
    }
    case "wholesale": {
      if (id.startsWith("prod:")) {
        const prodId = id.replace(/^prod:/, "");
        const p = await prisma.product.findUniqueOrThrow({ where: { id: prodId } });
        await prisma.product.update({
          where: { id: prodId },
          data: { status: p.status === "ACTIVE" ? "DRAFT" : "ACTIVE" },
        });
      } else {
        const log = await prisma.auditLog.findUniqueOrThrow({ where: { id } });
        const meta = (log.metadata as any) || {};
        const nextStatus = meta.status === "Approved" ? "Pending" : "Approved";
        await prisma.auditLog.update({
          where: { id },
          data: { metadata: { ...meta, status: nextStatus } },
        });
      }
      return getWholesaleResource();
    }
    case "banners":
    case "reports":
    case "marketing": {
      const log = await prisma.auditLog.findUniqueOrThrow({ where: { id } });
      const meta = (log.metadata as any) || {};
      const nextStatus =
        resource === "reports"
          ? meta.status === "Ready"
            ? "Processing"
            : "Ready"
          : meta.status === "Active"
          ? "Inactive"
          : "Active";
      await prisma.auditLog.update({
        where: { id },
        data: { metadata: { ...meta, status: nextStatus } },
      });
      return getResource(resource);
    }
    case "settings": {
      if (id.startsWith("zone:")) {
        const zId = id.replace(/^zone:/, "");
        const z = await prisma.shippingZone.findUniqueOrThrow({ where: { id: zId } });
        await prisma.shippingZone.update({ where: { id: zId }, data: { isActive: !z.isActive } });
      } else if (id.startsWith("tax:")) {
        const tId = id.replace(/^tax:/, "");
        const t = await prisma.taxRule.findUniqueOrThrow({ where: { id: tId } });
        await prisma.taxRule.update({ where: { id: tId }, data: { isActive: !t.isActive } });
      } else {
        const log = await prisma.auditLog.findUniqueOrThrow({ where: { id } });
        const meta = (log.metadata as any) || {};
        await prisma.auditLog.update({
          where: { id },
          data: { metadata: { ...meta, status: meta.status === "Inactive" ? "Active" : "Inactive" } },
        });
      }
      return getSettingsResource();
    }
    default:
      throw new AppError(status.BAD_REQUEST, `Unsupported resource: ${resource}`);
  }
};

// DELETE RESOURCE ITEM
const deleteResourceItem = async (resource: string, id: string, currentUserId?: string) => {
  switch (resource) {
    case "categories": {
      const cat = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });
      if (!cat) throw new AppError(status.NOT_FOUND, "Category not found");
      if (cat._count.products > 0) {
        const fallback = await prisma.category.upsert({
          where: { slug: "uncategorized" },
          update: {},
          create: { name: "Uncategorized", slug: "uncategorized", isActive: true },
        });
        await prisma.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: fallback.id },
        });
      }
      await prisma.category.delete({ where: { id } });
      return getCategoriesResource();
    }

    case "inventory":
    case "fans":
    case "rechargeable-fans": {
      await prisma.$transaction(async (tx) => {
        const variants = await tx.productVariant.findMany({ where: { productId: id } });
        const variantIds = variants.map((v) => v.id);
        if (variantIds.length > 0) {
          await tx.inventoryTransaction.deleteMany({ where: { variantId: { in: variantIds } } });
        }
        await tx.cartItem.deleteMany({ where: { productId: id } });
        await tx.wishlist.deleteMany({ where: { productId: id } });
        await tx.review.deleteMany({ where: { productId: id } });
        await tx.orderItem.deleteMany({ where: { productId: id } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
      return getResource(resource);
    }

    case "customers": {
      const orderCount = await prisma.order.count({ where: { userId: id } });
      if (orderCount > 0) {
        await prisma.user.update({
          where: { id },
          data: { isDeleted: true, deletedAt: new Date(), status: userStatus.DELETED },
        });
      } else {
        await prisma.address.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } });
      }
      return getCustomersResource();
    }

    case "coupons": {
      await prisma.auditLog.deleteMany({ where: { entity: "COUPON_META", entityId: id } });
      await prisma.coupon.delete({ where: { id } });
      return getCouponsResource();
    }

    case "reviews": {
      await prisma.review.delete({ where: { id } });
      return getReviewsResource();
    }

    case "employees": {
      const admin = await prisma.admin.findUnique({ where: { id } });
      if (!admin) throw new AppError(status.NOT_FOUND, "Employee not found");
      if (currentUserId && (admin.userId === currentUserId || admin.id === currentUserId)) {
        throw new AppError(status.BAD_REQUEST, "You cannot delete your own admin account");
      }
      await prisma.$transaction(async (tx) => {
        await tx.admin.update({
          where: { id },
          data: { isDeleted: true, deletedAt: new Date() },
        });
        await tx.user.update({
          where: { id: admin.userId },
          data: { isDeleted: true, deletedAt: new Date(), status: userStatus.DELETED },
        });
      });
      return getEmployeesResource();
    }

    case "brands": {
      if (id.startsWith("brand:")) {
        const bName = id.replace(/^brand:/, "");
        await prisma.product.updateMany({
          where: { brand: bName },
          data: { brand: null },
        });
      } else {
        const log = await prisma.auditLog.findUnique({ where: { id } });
        if (log) {
          const meta = (log.metadata as any) || {};
          if (meta.name) {
            await prisma.product.updateMany({
              where: { brand: meta.name },
              data: { brand: null },
            });
          }
          await prisma.auditLog.delete({ where: { id } });
        }
      }
      return getBrandsResource();
    }

    case "wholesale": {
      if (id.startsWith("prod:")) {
        const prodId = id.replace(/^prod:/, "");
        await prisma.product.update({
          where: { id: prodId },
          data: { isWholesale: false },
        });
      } else {
        await prisma.auditLog.delete({ where: { id } });
      }
      return getWholesaleResource();
    }

    case "banners":
    case "reports":
    case "marketing": {
      await prisma.auditLog.delete({ where: { id } });
      return getResource(resource);
    }

    case "settings": {
      if (id.startsWith("zone:")) {
        await prisma.shippingZone.delete({ where: { id: id.replace(/^zone:/, "") } });
      } else if (id.startsWith("tax:")) {
        await prisma.taxRule.delete({ where: { id: id.replace(/^tax:/, "") } });
      } else {
        await prisma.auditLog.delete({ where: { id } });
      }
      return getSettingsResource();
    }

    default:
      throw new AppError(status.BAD_REQUEST, `Unsupported resource: ${resource}`);
  }
};

const bulkDeleteResourceItems = async (
  resource: string,
  ids: string[],
  currentUserId?: string
) => {
  for (const id of ids) {
    await deleteResourceItem(resource, id, currentUserId);
  }
  return getResource(resource);
};

// ADMIN NOTIFICATIONS & GLOBAL SEARCH
const getNotifications = async (userId: string) => {
  const [stored, pendingOrders, lowStockProducts] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.order.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, total: true, createdAt: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE", stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 5,
      select: { id: true, name: true, stock: true, updatedAt: true },
    }),
  ]);

  const items = [
    ...stored.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      href: "/admin/dashboard",
      createdAt: formatDate(n.createdAt),
    })),
    ...pendingOrders.map((o) => ({
      id: `order:${o.id}`,
      title: `Pending Order ${o.orderNumber}`,
      message: `Awaiting confirmation (${formatMoney(Number(o.total))})`,
      type: "ORDER",
      isRead: false,
      href: "/admin/orders",
      createdAt: formatDate(o.createdAt),
    })),
    ...lowStockProducts.map((p) => ({
      id: `stock:${p.id}`,
      title: `Low Stock Alert: ${p.name}`,
      message: `Only ${p.stock} unit(s) remaining in stock`,
      type: "INVENTORY",
      isRead: false,
      href: "/admin/inventory",
      createdAt: formatDate(p.updatedAt),
    })),
  ];

  return {
    unreadCount: items.filter((i) => !i.isRead).length,
    items: items.slice(0, 12),
  };
};

const markNotificationsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return getNotifications(userId);
};

const globalSearch = async (query: string) => {
  const q = String(query || "").trim();
  if (!q) return { products: [], orders: [], customers: [], categories: [] };

  const [products, orders, customers, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, sku: true, price: true, status: true },
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { address: { recipientName: { contains: q, mode: "insensitive" } } },
          { address: { phone: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      select: { id: true, orderNumber: true, total: true, status: true },
    }),
    prisma.user.findMany({
      where: {
        role: Role.USER,
        isDeleted: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, status: true },
    }),
    prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, slug: true, isActive: true },
    }),
  ]);

  return {
    products: products.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: `SKU: ${p.sku} · ${formatMoney(Number(p.price))}`,
      href: `/admin/products/${p.id}/edit`,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      title: o.orderNumber,
      subtitle: `${o.status} · ${formatMoney(Number(o.total))}`,
      href: `/admin/orders`,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      title: c.name || c.email,
      subtitle: c.email,
      href: `/admin/customers`,
    })),
    categories: categories.map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: `/${cat.slug}`,
      href: `/admin/categories`,
    })),
  };
};

export const AdminResourcesService = {
  getResource,
  createResourceItem,
  updateResourceItem,
  toggleResourceStatus,
  deleteResourceItem,
  bulkDeleteResourceItems,
  getNotifications,
  markNotificationsRead,
  globalSearch,
};
