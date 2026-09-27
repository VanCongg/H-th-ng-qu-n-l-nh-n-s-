-- A deleted project's code can be used again: unique among live projects only.
DROP INDEX IF EXISTS "projects_code_key";

CREATE INDEX IF NOT EXISTS "projects_code_idx" ON "projects"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "projects_active_code_key"
ON "projects"("code")
WHERE "deleted_at" IS NULL;
