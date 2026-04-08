/*
  Warnings:

  - The values [FIRST_FITTING,SECOND_FITTING,THIRD_FITTING,FINAL_FITTING] on the enum `AppointmentTitle` will be removed. If these variants are still used in the database, this will fail.
  - The values [FIRST_FITTING,SECOND_FITTING,THIRD_FITTING,FINAL_FITTING] on the enum `BrideStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentTitle_new" AS ENUM ('CONSULTATION', 'MEASUREMENTS', 'CALICO', 'GOWN_IN_FABRIC', 'DETAIL_ON', 'ALTERATION', 'GOWN_COMPLETE', 'COLLECTION_READY', 'GOWN_TRY_ON', 'ALTERATIONS', 'RTW_GOWN_COMPLETE', 'RTW_COLLECTION_READY', 'CUSTOM');
ALTER TABLE "appointments" ALTER COLUMN "title" TYPE "AppointmentTitle_new" USING ("title"::text::"AppointmentTitle_new");
ALTER TYPE "AppointmentTitle" RENAME TO "AppointmentTitle_old";
ALTER TYPE "AppointmentTitle_new" RENAME TO "AppointmentTitle";
DROP TYPE "public"."AppointmentTitle_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BrideStage_new" AS ENUM ('CONSULTATION', 'MEASUREMENTS', 'CALICO', 'GOWN_IN_FABRIC', 'DETAIL_ON', 'ALTERATION', 'GOWN_COMPLETE', 'COLLECTION_READY', 'GOWN_TRY_ON', 'ALTERATIONS', 'RTW_GOWN_COMPLETE', 'RTW_COLLECTION_READY');
ALTER TABLE "public"."bride_profiles" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "bride_profiles" ALTER COLUMN "stage" TYPE "BrideStage_new" USING ("stage"::text::"BrideStage_new");
ALTER TYPE "BrideStage" RENAME TO "BrideStage_old";
ALTER TYPE "BrideStage_new" RENAME TO "BrideStage";
DROP TYPE "public"."BrideStage_old";
ALTER TABLE "bride_profiles" ALTER COLUMN "stage" SET DEFAULT 'CONSULTATION';
COMMIT;
