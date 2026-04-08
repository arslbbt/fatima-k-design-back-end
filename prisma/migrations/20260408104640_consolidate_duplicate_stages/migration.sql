/*
  Warnings:

  - The values [ALTERATIONS,RTW_GOWN_COMPLETE,RTW_COLLECTION_READY] on the enum `AppointmentTitle` will be removed. If these variants are still used in the database, this will fail.
  - The values [ALTERATIONS,RTW_GOWN_COMPLETE,RTW_COLLECTION_READY] on the enum `BrideStage` will be removed. If these variants are still used in the database, this will fail.

*/

-- Step 1: Map old AppointmentTitle values to new shared values
UPDATE "appointments" SET "title" = 'ALTERATION' WHERE "title" = 'ALTERATIONS';
UPDATE "appointments" SET "title" = 'GOWN_COMPLETE' WHERE "title" = 'RTW_GOWN_COMPLETE';
UPDATE "appointments" SET "title" = 'COLLECTION_READY' WHERE "title" = 'RTW_COLLECTION_READY';

-- Step 2: Map old BrideStage values to new shared values
UPDATE "bride_profiles" SET "stage" = 'ALTERATION' WHERE "stage" = 'ALTERATIONS';
UPDATE "bride_profiles" SET "stage" = 'GOWN_COMPLETE' WHERE "stage" = 'RTW_GOWN_COMPLETE';
UPDATE "bride_profiles" SET "stage" = 'COLLECTION_READY' WHERE "stage" = 'RTW_COLLECTION_READY';

-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentTitle_new" AS ENUM ('CONSULTATION', 'ALTERATION', 'GOWN_COMPLETE', 'COLLECTION_READY', 'MEASUREMENTS', 'CALICO', 'GOWN_IN_FABRIC', 'DETAIL_ON', 'GOWN_TRY_ON', 'CUSTOM');
ALTER TABLE "appointments" ALTER COLUMN "title" TYPE "AppointmentTitle_new" USING ("title"::text::"AppointmentTitle_new");
ALTER TYPE "AppointmentTitle" RENAME TO "AppointmentTitle_old";
ALTER TYPE "AppointmentTitle_new" RENAME TO "AppointmentTitle";
DROP TYPE "public"."AppointmentTitle_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "BrideStage_new" AS ENUM ('CONSULTATION', 'ALTERATION', 'GOWN_COMPLETE', 'COLLECTION_READY', 'MEASUREMENTS', 'CALICO', 'GOWN_IN_FABRIC', 'DETAIL_ON', 'GOWN_TRY_ON');
ALTER TABLE "public"."bride_profiles" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "bride_profiles" ALTER COLUMN "stage" TYPE "BrideStage_new" USING ("stage"::text::"BrideStage_new");
ALTER TYPE "BrideStage" RENAME TO "BrideStage_old";
ALTER TYPE "BrideStage_new" RENAME TO "BrideStage";
DROP TYPE "public"."BrideStage_old";
ALTER TABLE "bride_profiles" ALTER COLUMN "stage" SET DEFAULT 'CONSULTATION';
COMMIT;
