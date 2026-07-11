DROP INDEX IF EXISTS "team_members_team_id_employee_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "team_members_active_team_employee_key"
ON "team_members"("team_id", "employee_id")
WHERE "is_active" = true;
