-- CreateEnum
CREATE TYPE "AttendanceShift" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'EARLY_OUT', 'MANUAL_ADJUSTMENT');

-- AlterTable
ALTER TABLE "attendance_records"
  ADD COLUMN "shift" "AttendanceShift",
  ADD COLUMN "attendance_status" "AttendanceStatus",
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "address" VARCHAR(255),
  ADD COLUMN "distance_meters" INTEGER;

-- CreateTable
CREATE TABLE "system_settings" (
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
