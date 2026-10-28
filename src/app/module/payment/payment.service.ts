import status from "http-status";
import { prisma } from "../../lib/prisma.js";
import AppError from "../../errorHelpers/AppError.js";
import { paymentProvider } from "./payment.provider.js";

const payDemo = async (orderId: string, userId: string) => {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { payments: true } });
  if (!order) throw new AppError(status.NOT_FOUND, "Order not found");
  if (order.paymentStatus === "PAID") return order;
  if (order.paymentMethod !== "DEMO") throw new AppError(status.BAD_REQUEST, "This order is not configured for demo payment");

  const result = await paymentProvider.charge({ orderId: order.id, amount: Number(order.total) });
  return prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { orderId: order.id, provider: result.provider, transactionId: result.transactionId, amount: order.total, status: result.status, metadata: result.metadata } });
    return tx.order.update({ where: { id: order.id }, data: { paymentStatus: result.status }, include: { items: true, address: true, payments: true } });
  });
};

export const PaymentService = { payDemo };
