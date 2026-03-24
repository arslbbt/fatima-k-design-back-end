/*
  Warnings:

  - The values [FITTING,FINAL_PICKUP] on the enum `AppointmentTitle` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentTitle_new" AS ENUM ('CONSULTATION', 'FIRST_FITTING', 'SECOND_FITTING', 'THIRD_FITTING', 'FINAL_FITTING', 'ALTERATION', 'COLLECTION_READY', 'CUSTOM');
ALTER TABLE "appointments" ALTER COLUMN "title" TYPE "AppointmentTitle_new" USING ("title"::text::"AppointmentTitle_new");
ALTER TYPE "AppointmentTitle" RENAME TO "AppointmentTitle_old";
ALTER TYPE "AppointmentTitle_new" RENAME TO "AppointmentTitle";
DROP TYPE "public"."AppointmentTitle_old";
COMMIT;
