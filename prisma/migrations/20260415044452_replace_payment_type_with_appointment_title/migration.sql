/*
  Warnings:

  - Changed the type of `payment_type` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

-- Step 1: Add a temporary column to store the old values
ALTER TABLE "payments" ADD COLUMN "payment_type_temp" TEXT;

-- Step 2: Copy existing payment_type values to temp column
UPDATE "payments" SET "payment_type_temp" = "payment_type"::TEXT;

-- Step 3: Drop the old payment_type column
ALTER TABLE "payments" DROP COLUMN "payment_type";

-- Step 4: Add new payment_type column with AppointmentTitle type
ALTER TABLE "payments" ADD COLUMN "payment_type" "AppointmentTitle";

-- Step 5: Map old PaymentType values to AppointmentTitle values
-- BOOKING_DEPOSIT → CONSULTATION (first payment, aligns with consultation stage)
-- FABRICATION → MEASUREMENTS (for custom brides, after measurements)
-- CONSTRUCTION → GOWN_IN_FABRIC (for custom brides, during construction)
-- FINAL_BALANCE → COLLECTION_READY (final payment before collection)

UPDATE "payments" 
SET "payment_type" = CASE 
  WHEN "payment_type_temp" = 'BOOKING_DEPOSIT' THEN 'CONSULTATION'::text::"AppointmentTitle"
  WHEN "payment_type_temp" = 'FABRICATION' THEN 'MEASUREMENTS'::text::"AppointmentTitle"
  WHEN "payment_type_temp" = 'CONSTRUCTION' THEN 'GOWN_IN_FABRIC'::text::"AppointmentTitle"
  WHEN "payment_type_temp" = 'FINAL_BALANCE' THEN 'COLLECTION_READY'::text::"AppointmentTitle"
  ELSE 'CONSULTATION'::text::"AppointmentTitle" -- fallback
END;

-- Step 6: Make payment_type NOT NULL
ALTER TABLE "payments" ALTER COLUMN "payment_type" SET NOT NULL;

-- Step 7: Drop the temporary column
ALTER TABLE "payments" DROP COLUMN "payment_type_temp";

-- DropEnum
DROP TYPE "PaymentType";
