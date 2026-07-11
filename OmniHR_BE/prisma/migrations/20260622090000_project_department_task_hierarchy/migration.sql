-- Projects belong to a department, never directly to a team.
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_team_id_fkey";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_department_id_fkey";
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_manager_id_fkey";

DROP INDEX IF EXISTS "projects_department_id_team_id_manager_id_status_idx";
DROP INDEX IF EXISTS "projects_department_id_manager_id_status_idx";

ALTER TABLE "projects"
  DROP COLUMN IF EXISTS "team_id",
  ALTER COLUMN "department_id" SET NOT NULL,
  ALTER COLUMN "manager_id" SET NOT NULL;

CREATE INDEX "projects_department_id_manager_id_status_idx"
  ON "projects"("department_id", "manager_id", "status");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "projects_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A root task is assigned to a team; a child task is assigned to a team member.
ALTER TABLE "tasks" ADD COLUMN "parent_task_id" INTEGER;

CREATE INDEX "tasks_parent_task_id_status_idx"
  ON "tasks"("parent_task_id", "status");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_parent_task_id_fkey"
    FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
