/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomInt, randomUUID } from "node:crypto";
import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
import { paymentProvider } from "../payment/payment.provider.js";

const orderNumber = () => `ANC-${Date.now().toString().slice(-6)}-${randomInt(100, 999)}`;

const orderInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
        },
      },
    },
  },
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

const create = async (actorUserId: string | undefined, data: any) =>
  prisma.$transaction(async (tx) => {
    // 1. Resolve Customer Identity (Guest or Logged In)
    let customerUserId: string | null = actorUserId || null;
    const customerName = (data.customerName || data.name || "").trim() || "Guest Customer";
    const customerPhone = (data.phone || data.customerPhone || "").trim();
    const customerEmail = (data.email || data.customerEmail || "").trim().toLowerCase();

    if (!customerUserId && (customerEmail || customerPhone)) {
      // Find existing customer by email
      if (customerEmail) {
        const existing = await tx.user.findUnique({ where: { email: customerEmail } });
        if (existing) {
          customerUserId = existing.id;
        }
      }
      // If still not found, create a customer user record so they can sign in later
      if (!customerUserId) {
        const tempEmail = customerEmail || `guest.${customerPhone.replace(/[^0-9]/g, "") || Date.now()}@ancorporation.local`;
        const newUser = await tx.user.create({
          data: {
            id: randomUUID(),
            email: tempEmail,
            name: customerName,
            role: "USER",
            status: "ACTIVE",
            emailVerified: true,
          },
        });
        customerUserId = newUser.id;
      }
    }

    // 2. Resolve Delivery Address
    const addressLine = (data.addressLine || data.address || "").trim() || "Delivery Address";
    const city = (data.city || "Dhaka").trim();
    const area = (data.area || "").trim() || null;
    const postalCode = (data.postalCode || "").trim() || null;

    let addressId = data.addressId || null;
    if (!addressId && customerUserId) {
      const createdAddress = await tx.address.create({
        data: {
          userId: customerUserId,
          label: "Delivery",
          recipientName: customerName,
          phone: customerPhone || "01000000000",
          addressLine,
          city,
          area,
          postalCode,
          isDefault: true,
        },
      });
      addressId = createdAddress.id;
    }

    // 3. Resolve Items
    const rawItems = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];
    const resolvedItems: {
      productId: string;
      productName: string;
      sku: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    if (rawItems.length > 0) {
      for (const rawItem of rawItems) {
        const qty = Math.max(1, Number(rawItem.quantity || 1));
        let product = rawItem.productId
          ? await tx.product.findFirst({
              where: { OR: [{ id: rawItem.productId }, { sku: rawItem.productId }] },
            })
          : null;

        if (!product && rawItem.sku) {
          product = await tx.product.findFirst({ where: { sku: rawItem.sku } });
        }
        if (!product && (rawItem.productName || rawItem.name)) {
          const pName = (rawItem.productName || rawItem.name).trim();
          product = await tx.product.findFirst({
            where: { name: { equals: pName, mode: "insensitive" } },
          });
        }

        if (!product) {
          let defaultCat = await tx.category.findFirst();
          if (!defaultCat) {
            defaultCat = await tx.category.create({
              data: { name: "General", slug: "general", isActive: true },
            });
          }
          const pName = (rawItem.productName || rawItem.name || "Electrical Item").trim();
          const generatedSku = rawItem.sku?.trim() || `AN-${Date.now().toString().slice(-5)}-${randomInt(10, 99)}`;
          product = await tx.product.create({
            data: {
              name: pName,
              slug: `${pName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`,
              sku: generatedSku,
              price: Number(rawItem.unitPrice ?? rawItem.price ?? 0),
              stock: Math.max(qty, 20),
              status: "ACTIVE",
              categoryId: defaultCat.id,
              images: rawItem.image ? [rawItem.image] : [],
            },
          });
        }

        const unitPrice = Number(rawItem.unitPrice ?? rawItem.price ?? product.price ?? 0);
        resolvedItems.push({
          productId: product.id,
          productName: rawItem.productName?.trim() || rawItem.name?.trim() || product.name,
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
    } else if (customerUserId) {
      // Fallback to database cart if logged in
      const dbCart = await tx.cart.findUnique({
        where: { userId: customerUserId },
        include: { items: { include: { product: true } } },
      });
      if (!dbCart?.items.length) {
        throw new AppError(status.BAD_REQUEST, "No order items provided and cart is empty");
      }
      for (const item of dbCart.items) {
        resolvedItems.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          unitPrice: Number(item.product.price),
          quantity: item.quantity,
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.cartItem.deleteMany({ where: { cartId: dbCart.id } });
    } else {
      throw new AppError(status.BAD_REQUEST, "No order items provided");
    }

    // 4. Calculate Subtotal, Delivery Fee & Total
    const subtotal = resolvedItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const deliveryFee =
      data.deliveryFee !== undefined
        ? Number(data.deliveryFee)
        : city.toLowerCase().includes("dhaka")
        ? 60
        : 120;
    const discountAmount = Number(data.discountAmount || 0);
    const total = Math.max(0, subtotal + deliveryFee - discountAmount);

    const orderNum = orderNumber();
    const rawPayment = (data.paymentMethod || "CASH_ON_DELIVERY").toUpperCase();
    const paymentMethod =
      rawPayment === "DEMO" || rawPayment === "CARD" || rawPayment === "BKASH" || rawPayment === "NAGAD"
        ? rawPayment === "DEMO" ? "DEMO" : "CASH_ON_DELIVERY"
        : "CASH_ON_DELIVERY";

    const demoPayment =
      rawPayment === "DEMO"
        ? await paymentProvider.charge({ orderId: orderNum, amount: total })
        : null;

    // 5. Create Order
    const order = await tx.order.create({
      data: {
        orderNumber: orderNum,
        userId: customerUserId,
        addressId: addressId,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail || null,
        shippingAddress: addressLine,
        city: city,
        subtotal,
        deliveryFee,
        discountAmount,
        total,
        status: "PENDING",
        paymentMethod: paymentMethod as any,
        paymentStatus: demoPayment?.status ?? "UNPAID",
        note: data.note || null,
        items: {
          create: resolvedItems,
        },
        statusHistory: {
          create: {
            status: "PENDING",
            note: "Order placed successfully by customer",
            changedBy: customerUserId || "CUSTOMER",
          },
        },
        shipment: {
          create: {
            courier: city.toLowerCase().includes("dhaka") ? "Steadfast Courier" : "Pathao Express",
            trackingNumber: `TRK-${Date.now().toString().slice(-6)}`,
            status: "PENDING",
          },
        },
        payments: demoPayment
          ? {
              create: {
                provider: demoPayment.provider,
                transactionId: demoPayment.transactionId,
                amount: total,
                status: demoPayment.status,
                metadata: demoPayment.metadata,
              },
            }
          : undefined,
      },
      include: orderInclude,
    });

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
        customerName: data.customerName.trim(),
        customerPhone: data.phone.trim(),
        customerEmail: email,
        shippingAddress: data.addressLine.trim(),
        city: data.city?.trim() || "Dhaka",
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
                  courier: data.courier || "Steadfast Courier",
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

const list = async (
  userId?: string,
  isAdmin = false,
  userEmail?: string,
  userPhone?: string
) => {
  let where: any = {};

  if (!isAdmin) {
    where.isDeletedByUser = false;
    const orConditions: any[] = [];
    if (userId) orConditions.push({ userId });
    if (userEmail) orConditions.push({ customerEmail: { equals: userEmail, mode: "insensitive" } });
    if (userPhone) orConditions.push({ customerPhone: userPhone });

    if (orConditions.length > 0) {
      where.OR = orConditions;
    } else if (userId) {
      where.userId = userId;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(formatOrder);
};

const get = async (id: string, userId?: string, isAdmin = false) => {
  const cleanId = id.trim().replace(/^#/, "");
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: cleanId }, { orderNumber: cleanId }, { orderNumber: id }],
      ...(isAdmin || !userId ? {} : { userId }),
    },
    include: orderInclude,
  });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  return formatOrder(order);
};

const trackOrder = async (query: string) => {
  const cleanQuery = query.trim().replace(/^#/, "");
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { equals: cleanQuery, mode: "insensitive" } },
        { orderNumber: { equals: query, mode: "insensitive" } },
        { id: cleanQuery },
        { shipment: { trackingNumber: { equals: cleanQuery, mode: "insensitive" } } },
      ],
    },
    include: orderInclude,
  });
  if (!order) {
    throw new AppError(status.NOT_FOUND, `Order "${query}" was not found.`);
  }
  return formatOrder(order);
};

const cancelOrder = async (
  id: string,
  actorUserId?: string,
  reason?: string,
  isAdmin = false
) => {
  const existing = await get(id, actorUserId, isAdmin);
  const targetId = existing.id;

  if (existing.status === "DELIVERED") {
    throw new AppError(status.BAD_REQUEST, "Delivered orders cannot be cancelled.");
  }
  if (existing.status === "CANCELLED") {
    return existing;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update order status and cancellation reason
    const cancelReason = reason || "Cancelled by customer";
    const order = await tx.order.update({
      where: { id: targetId },
      data: {
        status: "CANCELLED",
        cancelReason,
      },
      include: orderInclude,
    });

    // 2. Add history
    await tx.orderStatusHistory.create({
      data: {
        orderId: targetId,
        status: "CANCELLED",
        note: cancelReason,
        changedBy: actorUserId || "CUSTOMER",
      },
    });

    // 3. Restock items
    for (const item of existing.items || []) {
      if (item.productId && item.quantity) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        }).catch(() => null);
      }
    }

    // 4. Update shipment if exists
    await tx.shipment.updateMany({
      where: { orderId: targetId },
      data: { status: "FAILED" },
    }).catch(() => null);

    return order;
  });

  return formatOrder(updated);
};

const userDeleteOrder = async (id: string, actorUserId?: string) => {
  const existing = await get(id, actorUserId, true);
  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: { isDeletedByUser: true },
    include: orderInclude,
  });
  return formatOrder(updated);
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
    if (data.cancelReason !== undefined) orderUpdate.cancelReason = data.cancelReason;
    if (data.customerName !== undefined) orderUpdate.customerName = data.customerName;
    if (data.phone !== undefined) orderUpdate.customerPhone = data.phone;
    if (data.addressLine !== undefined) orderUpdate.shippingAddress = data.addressLine;
    if (data.city !== undefined) orderUpdate.city = data.city;

    const isNowDelivered = data.status === "DELIVERED";
    if (isNowDelivered) {
      orderUpdate.paymentStatus = "PAID";
    }

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
          note: data.note || data.cancelReason || `Status updated to ${data.status}`,
          changedBy: actorId || null,
        },
      });

      // If status changed to CANCELLED, restock items
      if (data.status === "CANCELLED") {
        for (const item of existing.items || []) {
          if (item.productId && item.quantity) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => null);
          }
        }
      }
    }

    if (existing.addressId && (data.customerName || data.phone || data.addressLine || data.city)) {
      await tx.address.update({
        where: { id: existing.addressId },
        data: {
          ...(data.customerName ? { recipientName: data.customerName.trim() } : {}),
          ...(data.phone ? { phone: data.phone.trim() } : {}),
          ...(data.addressLine ? { addressLine: data.addressLine.trim() } : {}),
          ...(data.city ? { city: data.city.trim() } : {}),
        },
      }).catch(() => null);
    }

    if (data.courier !== undefined || data.trackingNumber !== undefined || data.status) {
      const shipmentStatus: any =
        data.status === "DELIVERED"
          ? "DELIVERED"
          : data.status === "SHIPPED"
          ? "SHIPPED"
          : data.status === "PROCESSING"
          ? "READY"
          : data.status === "CANCELLED"
          ? "FAILED"
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
          courier: data.courier || "Steadfast Courier",
          trackingNumber: data.trackingNumber || `TRK-${Date.now().toString().slice(-6)}`,
          status: shipmentStatus,
        },
      });
    }

    if (data.paymentStatus === "PAID" || isNowDelivered) {
      const existingPayments = await tx.payment.count({ where: { orderId: targetId } });
      if (existingPayments === 0) {
        await tx.payment.create({
          data: {
            orderId: targetId,
            provider: "DEMO",
            transactionId: `TXN-DELIVERED-${Date.now().toString().slice(-6)}-${randomInt(100, 999)}`,
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
  trackOrder,
  cancelOrder,
  userDeleteOrder,
  updateStatus,
  bulkUpdateStatus,
  remove,
  bulkRemove,
};
