-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "ics_sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ics_uid" TEXT;
