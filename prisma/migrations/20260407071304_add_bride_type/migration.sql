-- CreateEnum
CREATE TYPE "BrideType" AS ENUM ('CUSTOM', 'READY_TO_WEAR');

-- AlterTable
ALTER TABLE "bride_profiles" ADD COLUMN     "bride_type" "BrideType" NOT NULL DEFAULT 'CUSTOM';
