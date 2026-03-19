-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "google_event_id" TEXT,
ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);
