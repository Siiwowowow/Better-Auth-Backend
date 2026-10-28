import { randomBytes } from "node:crypto";

export type PaymentResult = {
  provider: "DEMO";
  transactionId: string;
  status: "PAID";
  metadata: Record<string, string>;
};

/**
 * Payment gateway boundary. A real provider can implement this contract
 * without changing order or checkout business logic.
 */
export interface PaymentProvider {
  charge(input: { orderId: string; amount: number }): Promise<PaymentResult>;
}

export class DemoPaymentProvider implements PaymentProvider {
  async charge(input: { orderId: string; amount: number }): Promise<PaymentResult> {
    return {
      provider: "DEMO",
      transactionId: `DEMO-${input.orderId.slice(0, 8)}-${randomBytes(4).toString("hex")}`,
      status: "PAID",
      metadata: { mode: "demo", amount: input.amount.toFixed(2) },
    };
  }
}

export const paymentProvider: PaymentProvider = new DemoPaymentProvider();
