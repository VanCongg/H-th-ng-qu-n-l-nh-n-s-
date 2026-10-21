-- Aligns the database with prisma/schema.prisma. Each statement below fixes a
-- drift that accumulated because an earlier migration changed a model without
-- migrating the old object away; `prisma migrate diff` reported all of them.

-- The team_structure migration added a team_id column to this composite index
-- but never dropped the pre-team version, so both have been maintained since.
-- DropIndex
DROP INDEX "tasks_project_id_department_id_assignee_id_status_priority_idx";

-- schema.prisma declares this index on TeamMember, but no migration ever
-- created it.
-- CreateIndex
CREATE INDEX "team_members_team_id_employee_id_is_active_idx" ON "team_members"("team_id", "employee_id", "is_active");

-- The parentTask relation is optional and declares no onDelete, so Prisma
-- expects SET NULL; the migration that introduced the hierarchy hardcoded
-- RESTRICT. Tasks are soft-deleted today, so this never fired in practice.
-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parent_task_id_fkey";

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Postgres truncated the generated name to 63 characters, which differs from
-- the name Prisma derives for the same index.
-- RenameIndex
ALTER INDEX "tasks_project_id_department_id_team_id_assignee_id_status_prior" RENAME TO "tasks_project_id_department_id_team_id_assignee_id_status_p_idx";
