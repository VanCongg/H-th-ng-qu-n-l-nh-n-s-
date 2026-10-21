-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "employee_compensations" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "insurance_salary" INTEGER,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "calculated_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "finalized_by_user_id" INTEGER,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "allowance" INTEGER NOT NULL,
    "insurance_salary" INTEGER NOT NULL,
    "standard_work_days" DOUBLE PRECISION NOT NULL,
    "attendance_days" DOUBLE PRECISION NOT NULL,
    "paid_leave_days" DOUBLE PRECISION NOT NULL,
    "payable_days" DOUBLE PRECISION NOT NULL,
    "late_minutes" INTEGER NOT NULL,
    "early_leave_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL,
    "missing_check_outs" INTEGER NOT NULL,
    "gross_salary" INTEGER NOT NULL,
    "overtime_pay" INTEGER NOT NULL,
    "attendance_deduction" INTEGER NOT NULL,
    "insurance_deduction" INTEGER NOT NULL,
    "net_salary" INTEGER NOT NULL,
    "emailed_at" TIMESTAMP(3),
    "email_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_compensations_employee_id_key" ON "employee_compensations"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_year_month_key" ON "payroll_periods"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_period_id_employee_id_key" ON "payslips"("period_id", "employee_id");

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

