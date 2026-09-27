-- Half-day leave: a one-day request may cover only one shift, costing 0.5 day.
CREATE TYPE "LeaveHalf" AS ENUM ('MORNING', 'AFTERNOON');

ALTER TABLE "leave_requests"
    ALTER COLUMN "total_days" TYPE DOUBLE PRECISION,
    ADD COLUMN "half_day" "LeaveHalf",
    -- Withdrawing an approved leave is a request a manager decides on.
    ADD COLUMN "cancel_request_reason" VARCHAR(1000),
    ADD COLUMN "cancel_requested_at" TIMESTAMP(3);

ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_CANCEL_REJECTED';
