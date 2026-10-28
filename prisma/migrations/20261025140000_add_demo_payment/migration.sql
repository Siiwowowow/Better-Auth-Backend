-- Add the first payment provider without changing existing orders.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DEMO';

CREATE TYPE "PaymentProvider" AS ENUM ('DEMO', 'BKASH', 'STRIPE', 'SSLCOMMERZ');

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");
CREATE INDEX "payments_orderId_createdAt_idx" ON "payments"("orderId", "createdAt");
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
