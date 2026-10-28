import { OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const dayLabel = (value: Date) =>
  value.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const dateLabel = (value: Date) =>
  value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const buildDailySeries = (from: Date, days: number, totals: Map<string, number>) => {
  const series: { label: string; value: number }[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = startOfDay(from);
    day.setDate(day.getDate() + offset);
    const label = dayLabel(day);
    series.push({ label, value: totals.get(label) || 0 });
  }
  return series;
};

const getOverview = async () => {
  const today = startOfDay(new Date());
  const last30Start = startOfDay(new Date(today));
  last30Start.setDate(last30Start.getDate() - 29);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [
    totalOrders,
    pendingOrders,
    totalProducts,
    salesAggregate,
    statusGroups,
    returnedCount,
    recentOrders,
    inventoryCandidates,
    chartOrders,
    orderItemsWithProduct,
    customerUsers,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.product.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: OrderStatus.CANCELLED } },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.returnRequest.count(),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        items: { select: { productName: true } },
        address: { select: { recipientName: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, stock: true, lowStockAt: true },
      orderBy: { stock: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: last30Start < yearStart ? last30Start : yearStart },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { not: OrderStatus.CANCELLED } } },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        unitPrice: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "USER", isDeleted: false },
      select: { id: true, createdAt: true },
    }),
  ]);

  const statusCount = (orderStatus: OrderStatus) =>
    statusGroups.find((group) => group.status === orderStatus)?._count.status || 0;

  const dailyTotals = new Map<string, number>();
  const monthlyTotals = new Map<string, number>();
  const monthlyOrders = new Map<string, number>();
  const currentYear = today.getFullYear();

  for (const order of chartOrders) {
    const created = new Date(order.createdAt);
    const amount = Number(order.total) || 0;
    if (created >= last30Start) {
      dailyTotals.set(dayLabel(created), (dailyTotals.get(dayLabel(created)) || 0) + amount);
    }
    if (created.getFullYear() === currentYear) {
      const month = MONTHS[created.getMonth()];
      monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + amount);
      monthlyOrders.set(month, (monthlyOrders.get(month) || 0) + 1);
    }
  }

  const salesByMonth = MONTHS.map((month) => ({
    label: month,
    value: monthlyTotals.get(month) || 0,
  }));

  const revenueAnalytics = MONTHS.map((month) => ({
    month,
    sales: monthlyTotals.get(month) || 0,
    orders: monthlyOrders.get(month) || 0,
  }));

  const customerMonthly = new Map<string, number>();
  for (const u of customerUsers) {
    const created = new Date(u.createdAt);
    if (created.getFullYear() === currentYear) {
      const m = MONTHS[created.getMonth()];
      customerMonthly.set(m, (customerMonthly.get(m) || 0) + 1);
    }
  }
  const customerGrowth = MONTHS.map((month) => ({
    month,
    customers: customerMonthly.get(month) || 0,
  }));

  const productSalesMap = new Map<string, { id: string; name: string; sold: number; revenue: number }>();
  for (const item of orderItemsWithProduct) {
    const current = productSalesMap.get(item.productId) || {
      id: item.productId,
      name: item.productName,
      sold: 0,
      revenue: 0,
    };
    current.sold += Number(item.quantity) || 0;
    current.revenue += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    productSalesMap.set(item.productId, current);
  }
  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return {
    stats: {
      totalSales: Number(salesAggregate._sum.total) || 0,
      totalOrders,
      totalProducts,
      pendingOrders,
    },
    salesLast30Days: buildDailySeries(last30Start, 30, dailyTotals),
    salesByMonth,
    revenueAnalytics,
    customerGrowth,
    topProducts,
    statusCounts: {
      delivered: statusCount(OrderStatus.DELIVERED),
      processing:
        statusCount(OrderStatus.CONFIRMED) +
        statusCount(OrderStatus.PROCESSING) +
        statusCount(OrderStatus.SHIPPED),
      pending: statusCount(OrderStatus.PENDING),
      cancelled: statusCount(OrderStatus.CANCELLED),
      returned: returnedCount,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName:
        order.address?.recipientName || order.user?.name || order.user?.email || "Customer",
      productNames: order.items.map((item) => item.productName),
      amount: Number(order.total) || 0,
      status: order.status,
      date: dateLabel(order.createdAt),
    })),
    inventoryAlerts: inventoryCandidates
      .filter((product) => product.stock <= (product.lowStockAt ?? 5))
      .slice(0, 6)
      .map((product) => ({
        id: product.id,
        name: product.name,
        currentStock: product.stock,
        threshold: product.lowStockAt ?? 5,
        status: product.stock <= 5 ? "CRITICAL" : "LOW_STOCK",
      })),
  };
};

export const AdminDashboardService = { getOverview };
