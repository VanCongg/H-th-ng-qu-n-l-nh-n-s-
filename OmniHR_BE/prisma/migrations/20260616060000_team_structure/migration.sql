CREATE TYPE "TeamMemberRole" AS ENUM ('LEAD', 'MEMBER');

CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "lead_id" INTEGER,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "role_in_team" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "projects" ADD COLUMN "team_id" INTEGER;
ALTER TABLE "tasks" ADD COLUMN "team_id" INTEGER;

CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");
CREATE INDEX "teams_department_id_lead_id_is_active_idx" ON "teams"("department_id", "lead_id", "is_active");
CREATE UNIQUE INDEX "team_members_team_id_employee_id_key" ON "team_members"("team_id", "employee_id");
CREATE INDEX "team_members_employee_id_is_active_idx" ON "team_members"("employee_id", "is_active");
CREATE INDEX "projects_department_id_team_id_manager_id_status_idx" ON "projects"("department_id", "team_id", "manager_id", "status");
CREATE INDEX "tasks_project_id_department_id_team_id_assignee_id_status_priority_idx" ON "tasks"("project_id", "department_id", "team_id", "assignee_id", "status", "priority");

ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
