-- Payroll and performance reviews are out of scope: drop the tables, the
-- notification type they raised and the permissions that only guarded them.

-- Notifications must stop using REVIEW_FINALIZED before the value can go.
DELETE FROM "notifications" WHERE "type" = 'REVIEW_FINALIZED';

-- DropTable
DROP TABLE IF EXISTS "payslips";
DROP TABLE IF EXISTS "payroll_periods";
DROP TABLE IF EXISTS "employee_compensations";
DROP TABLE IF EXISTS "performance_reviews";
DROP TABLE IF EXISTS "review_cycles";

-- AlterTable
ALTER TABLE "ai_task_suggestion_items" DROP COLUMN "performance_score";

-- DropEnum
DROP TYPE IF EXISTS "PayrollPeriodStatus";
DROP TYPE IF EXISTS "PerformanceReviewStatus";
DROP TYPE IF EXISTS "ReviewCycleStatus";

-- AlterEnum: rebuild NotificationType without REVIEW_FINALIZED.
CREATE TYPE "NotificationType_new" AS ENUM ('LEAVE_APPROVED', 'LEAVE_REJECTED', 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'ATTENDANCE_ADJUSTED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

-- Drop the permissions that only existed for these two modules.
DELETE FROM "role_permissions" WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "code" IN (
    'PAYROLL_READ', 'PAYROLL_MANAGE',
    'REVIEW_READ_SELF', 'REVIEW_SUBMIT_SELF', 'REVIEW_READ_TEAM',
    'REVIEW_SUBMIT_MANAGER', 'REVIEW_READ_ALL', 'REVIEW_MANAGE'
  )
);
DELETE FROM "permissions" WHERE "code" IN (
  'PAYROLL_READ', 'PAYROLL_MANAGE',
  'REVIEW_READ_SELF', 'REVIEW_SUBMIT_SELF', 'REVIEW_READ_TEAM',
  'REVIEW_SUBMIT_MANAGER', 'REVIEW_READ_ALL', 'REVIEW_MANAGE'
);
