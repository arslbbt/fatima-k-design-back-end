-- AlterTable
ALTER TABLE "bride_profiles" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'AU',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AUD';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amount_in_aud" DECIMAL(10,2),
ADD COLUMN     "converted_at" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AUD',
ADD COLUMN     "exchange_rate_source" TEXT,
ADD COLUMN     "exchange_rate_to_aud" DECIMAL(10,6);
