-- Migration generated manually for Payments Module Sync

-- 1. Create temporary new Enum types for Status and Type
-- This avoids "ALTER TYPE ADD VALUE" which cannot be run in a transaction.

-- Alter Status
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PAID', 'PENDING', 'OVERDUE');
ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING (
  CASE 
    WHEN "status"::text = 'PAID' THEN 'PAID'::"PaymentStatus_new"
    WHEN "status"::text = 'PENDING' THEN 'PENDING'::"PaymentStatus_new"
    WHEN "status"::text = 'OVERDUE' THEN 'OVERDUE'::"PaymentStatus_new"
    ELSE 'PENDING'::"PaymentStatus_new"
  END
);
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- Alter Type
BEGIN;
CREATE TYPE "PaymentType_new" AS ENUM ('BOOKING_DEPOSIT', 'FABRICATION', 'CONSTRUCTION', 'FINAL_BALANCE');
ALTER TABLE "payments" ALTER COLUMN "payment_type" TYPE "PaymentType_new" USING (
  CASE 
    WHEN "payment_type"::text = 'DEPOSIT' THEN 'BOOKING_DEPOSIT'::"PaymentType_new"
    WHEN "payment_type"::text = 'INSTALLMENT' THEN 'FABRICATION'::"PaymentType_new"
    WHEN "payment_type"::text = 'FINAL' THEN 'FINAL_BALANCE'::"PaymentType_new"
    WHEN "payment_type"::text = 'BOOKING_DEPOSIT' THEN 'BOOKING_DEPOSIT'::"PaymentType_new"
    WHEN "payment_type"::text = 'FABRICATION' THEN 'FABRICATION'::"PaymentType_new"
    WHEN "payment_type"::text = 'CONSTRUCTION' THEN 'CONSTRUCTION'::"PaymentType_new"
    WHEN "payment_type"::text = 'FINAL_BALANCE' THEN 'FINAL_BALANCE'::"PaymentType_new"
    ELSE 'BOOKING_DEPOSIT'::"PaymentType_new"
  END
);
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "public"."PaymentType_old";
COMMIT;

-- Alter Table Columns
-- Add columns only if they don't exist (Manual check for dev safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='reminder_sent_at') THEN
        ALTER TABLE "payments" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updated_at') THEN
        ALTER TABLE "payments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
