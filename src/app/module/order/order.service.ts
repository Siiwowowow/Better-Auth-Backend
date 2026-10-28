/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomInt, randomUUID } from "node:crypto";
import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
import { paymentProvider } from "../payment/payment.provider.js";

const orderNumber = () => `ANC-${Date.now().toString().slice(-6)}-${randomInt(100, 999)}`;

const orderInclude = {
  items: true,
  address: true,
  user: { select: { id: true, name: true, email: true, image: true } },
  payments: true,
  shipment: true,
  returns: true,
  statusHistory: { orderBy: { createdAt: "desc" as const } },
};

const formatOrder = (order: any) => ({
  ...order,
  subtotal: Number(order.subtotal),
  deliveryFee: Number(order.deliveryFee),
  discountAmount: Number(order.discountAmount ?? 0),
  taxAmount: Number(order.taxAmount ?? 0),
  total: Number(order.total),
  items: Array.isArray(order.items)
    ? order.items.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
      }))
    : [],
  payments: Array.isArray(order.payments)
    ? order.payments.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
      }))
    : [],
});

const create = async (userId: string, data: any) =>
  prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: data.addressId, userId } });
    if (!address) throw new AppError(status.BAD_REQUEST, "Valid delivery address is required");

    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart?.items.length) throw new AppError(status.BAD_REQUEST, "Cart is empty");

    for (const item of cart.items) {
      if (item.product.status !== "ACTIVE" || item.quantity > item.product.stock) {
        throw new AppError(status.BAD_REQUEST, `Insufficient stock for ${item.product.name}`);
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );
    const activeZones = await tx.shippingZone.findMany({ where: { isActive: true } });
    const matchedZone = activeZones.find((z) =>
      z.cities.some((c) => c.toLowerCase() === (address.city || "").toLowerCase())
    ) || activeZones[0];
    const baseDeliveryFee = matchedZone ? Number(matchedZone.deliveryFee) : 100;
    const deliveryFee = subtotal >= 5000 ? 0 : baseDeliveryFee;
    const orderNum = orderNumber();
    const demoPayment =
      data.paymentMethod === "DEMO"
        ? await paymentProvider.charge({ orderId: orderNum, amount: subtotal + deliveryFee })
        : null;

    const order = await tx.order.create({
      data: {
        orderNumber: orderNum,
        userId,
        addressId: address.id,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        paymentMethod: data.paymentMethod,
        paymentStatus: demoPayment?.status ?? "UNPAID",
        note: data.note,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            unitPrice: item.product.price,
            quantity: item.quantity,
          })),
        },
        statusHistory: {
          create: {
            status: "PENDING",
            note: "Order placed by customer",
            changedBy: userId,
          },
        },
        payments: demoPayment
          ? {
              create: {
                provider: demoPayment.provider,
                transactionId: demoPayment.transactionId,
                amount: subtotal + deliveryFee,
                status: demoPayment.status,
                metadata: demoPayment.metadata,
              },
            }
          : undefined,
      },
      include: orderInclude,
    });

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return formatOrder(order);
  });

const createAdminOrder = async (adminUserId: string, data: any) =>
  prisma.$transaction(async (tx) => {
    const email = (
      data.email?.trim() ||
      `customer.${data.phone.replace(/[^0-9]/g, "") || Date.now()}@ancorporation.local`
    ).toLowerCase();

    let customer = await tx.user.findUnique({ where: { email } });
    if (!customer) {
      customer = await tx.user.create({
        data: {
          id: randomUUID(),
          email,
          name: data.customerName.trim(),
          role: "USER",
          status: "ACTIVE",
          emailVerified: true,
        },
      });
    } else if (data.customerName && customer.name !== data.customerName.trim()) {
      customer = await tx.user.update({
        where: { id: customer.id },
        data: { name: data.customerName.trim() },
      });
    }

    const address = await tx.address.create({
      data: {
        userId: customer.id,
        label: "Delivery",
        recipientName: data.customerName.trim(),
        phone: data.phone.trim(),
        addressLine: data.addressLine.trim(),
        city: data.city?.trim() || "Dhaka",
        area: data.area?.trim() || null,
        isDefault: true,
      },
    });

    const resolvedItems: {
      productId: string;
      productName: string;
      sku: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    for (const rawItem of data.items || []) {
      const qty = Math.max(1, Number(rawItem.quantity || 1));
      let product = rawItem.productId
        ? await tx.product.findFirst({
            where: { OR: [{ id: rawItem.productId }, { sku: rawItem.productId }] },
          })
        : null;

      if (!product && rawItem.sku) {
        product = await tx.product.findFirst({ where: { sku: rawItem.sku } });
      }
      if (!product && rawItem.productName) {
        product = await tx.product.findFirst({
          where: { name: { equals: rawItem.productName.trim(), mode: "insensitive" } },
        });
      }

      if (!product) {
        let defaultCat = await tx.category.findFirst();
        if (!defaultCat) {
          defaultCat = await tx.category.create({
            data: { name: "General", slug: "general", isActive: true },
          });
        }
        const generatedSku = rawItem.sku?.trim() || `AN-${Date.now().toString().slice(-5)}-${randomInt(10, 99)}`;
        product = await tx.product.create({
          data: {
            name: rawItem.productName.trim(),
            slug: `${rawItem.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`,
            sku: generatedSku,
            price: Number(rawItem.unitPrice || 0),
            stock: Math.max(qty, 20),
            status: "ACTIVE",
            categoryId: defaultCat.id,
            images: [],
          },
        });
      }

      const unitPrice = Number(rawItem.unitPrice ?? product.price ?? 0);
      resolvedItems.push({
        productId: product.id,
        productName: rawItem.productName?.trim() || product.name,
        sku: rawItem.sku?.trim() || product.sku,
        unitPrice,
        quantity: qty,
      });

      if (product.stock >= qty) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: qty } },
        });
      }
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee =
      data.deliveryFee !== undefined
        ? Number(data.deliveryFee)
        : (data.city || "Dhaka").toLowerCase().includes("dhaka")
        ? 60
        : 120;
    const discountAmount = Number(data.discountAmount || 0);
    const total = Math.max(0, subtotal + deliveryFee - discountAmount);
    const orderNum = orderNumber();
    const orderStatus = data.status || "PENDING";
    const paymentMethod = data.paymentMethod || "CASH_ON_DELIVERY";
    const paymentStatus = data.paymentStatus || (paymentMethod === "DEMO" ? "PAID" : "UNPAID");

    const order = await tx.order.create({
      data: {
        orderNumber: orderNum,
        userId: customer.id,
        addressId: address.id,
        subtotal,
        deliveryFee,
        discountAmount,
        total,
        status: orderStatus,
        paymentMethod,
        paymentStatus,
        note: data.note || null,
        items: {
          create: resolvedItems,
        },
        statusHistory: {
          create: {
            status: orderStatus,
            note: "Order created by Admin",
            changedBy: adminUserId,
          },
        },
        ...(paymentStatus === "PAID"
          ? {
              payments: {
                create: {
                  provider: "DEMO",
                  transactionId: `TXN-${Date.now()}-${randomInt(100, 999)}`,
                  amount: total,
                  status: "PAID",
                },
              },
            }
          : {}),
        ...(data.courier || data.trackingNumber
          ? {
              shipment: {
                create: {
                  courier: data.courier || "Pathao",
                  trackingNumber: data.trackingNumber || `TRK-${Date.now().toString().slice(-6)}`,
                  status:
                    orderStatus === "DELIVERED"
                      ? "DELIVERED"
                      : orderStatus === "SHIPPED"
                      ? "SHIPPED"
                      : "PENDING",
                },
              },
            }
          : {}),
      },
      include: orderInclude,
    });

    return formatOrder(order);
  });

const list = async (userId: string, isAdmin = false) => {
  const orders = await prisma.order.findMany({
    where: isAdmin ? {} : { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(formatOrder);
};

const get = async (id: string, userId: string, isAdmin = false) => {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id }, { orderNumber: id }],
      ...(isAdmin ? {} : { userId }),
    },
    include: orderInclude,
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  return formatOrder(order);
};

const updateStatus = async (id: string, data: any, actorId?: string) => {
  const existing = await get(id, "", true);
  const targetId = existing.id;

  const updated = await prisma.$transaction(async (tx) => {
    const orderUpdate: any = {};
    if (data.status !== undefined) orderUpdate.status = data.status;
    if (data.paymentStatus !== undefined) orderUpdate.paymentStatus = data.paymentStatus;
    if (data.paymentMethod !== undefined) orderUpdate.paymentMethod = data.paymentMethod;
    if (data.note !== undefined) orderUpdate.note = data.note;

    if (Object.keys(orderUpdate).length > 0) {
      await tx.order.update({
        where: { id: targetId },
        data: orderUpdate,
      });
    }

    if (data.status && data.status !== existing.status) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: targetId,
          status: data.status,
          note: data.note || `Status updated to ${data.status}`,
          changedBy: actorId || null,
        },
      });
    }

    if (data.customerName || data.phone || data.addressLine || data.city) {
      await tx.address.update({
        where: { id: existing.addressId },
        data: {
          ...(data.customerName ? { recipientName: data.customerName.trim() } : {}),
          ...(data.phone ? { phone: data.phone.trim() } : {}),
          ...(data.addressLine ? { addressLine: data.addressLine.trim() } : {}),
          ...(data.city ? { city: data.city.trim() } : {}),
        },
      });
    }

    if (data.courier !== undefined || data.trackingNumber !== undefined || data.status) {
      const shipmentStatus =
        data.status === "DELIVERED"
          ? "DELIVERED"
          : data.status === "SHIPPED"
          ? "SHIPPED"
          : data.status === "PROCESSING"
          ? "READY"
          : "PENDING";

      await tx.shipment.upsert({
        where: { orderId: targetId },
        update: {
          ...(data.courier !== undefined ? { courier: data.courier } : {}),
          ...(data.trackingNumber !== undefined ? { trackingNumber: data.trackingNumber } : {}),
          status: shipmentStatus,
          ...(data.status === "SHIPPED" ? { shippedAt: new Date() } : {}),
          ...(data.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        },
        create: {
          orderId: targetId,
          courier: data.courier || "Standard Courier",
          trackingNumber: data.trackingNumber || `TRK-${Date.now().toString().slice(-6)}`,
          status: shipmentStatus,
        },
      });
    }

    if (data.paymentStatus === "PAID") {
      const existingPayments = await tx.payment.count({ where: { orderId: targetId } });
      if (existingPayments === 0) {
        await tx.payment.create({
          data: {
            orderId: targetId,
            provider: "DEMO",
            transactionId: `TXN-${Date.now()}-${randomInt(100, 999)}`,
            amount: existing.total,
            status: "PAID",
          },
        });
      } else {
        await tx.payment.updateMany({
          where: { orderId: targetId },
          data: { status: "PAID" },
        });
      }
    }

    return tx.order.findUniqueOrThrow({
      where: { id: targetId },
      include: orderInclude,
    });
  });

  return formatOrder(updated);
};

const bulkUpdateStatus = async (ids: string[], data: any, actorId?: string) => {
  const results = [];
  for (const id of ids) {
    const updated = await updateStatus(id, data, actorId);
    results.push(updated);
  }
  return results;
};

const remove = async (id: string) => {
  const existing = await get(id, "", true);
  const targetId = existing.id;

  await prisma.$transaction(async (tx) => {
    await tx.couponRedemption.deleteMany({ where: { orderId: targetId } });
    await tx.invoice.deleteMany({ where: { orderId: targetId } });
    await tx.shipment.deleteMany({ where: { orderId: targetId } });
    await tx.returnRequest.deleteMany({ where: { orderId: targetId } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: targetId } });
    await tx.payment.deleteMany({ where: { orderId: targetId } });
    await tx.orderItem.deleteMany({ where: { orderId: targetId } });
    await tx.order.delete({ where: { id: targetId } });
  });

  return existing;
};

const bulkRemove = async (ids: string[]) => {
  for (const id of ids) {
    await remove(id);
  }
  return { deletedCount: ids.length };
};

export const OrderService = {
  create,
  createAdminOrder,
  list,
  get,
  updateStatus,
  bulkUpdateStatus,
  remove,
  bulkRemove,
};
