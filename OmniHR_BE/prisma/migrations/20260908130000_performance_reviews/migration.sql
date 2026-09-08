-- CreateEnum
CREATE TYPE "ReviewCycleStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('PENDING_SELF', 'SELF_SUBMITTED', 'MANAGER_REVIEWED', 'FINALIZED');

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "ReviewCycleStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "reviewer_user_id" INTEGER,
    "self_rating" INTEGER,
    "self_comment" TEXT,
    "manager_rating" INTEGER,
    "manager_comment" TEXT,
    "final_rating" INTEGER,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'PENDING_SELF',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycle_id_employee_id_key" ON "performance_reviews"("cycle_id", "employee_id");

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
