CREATE TYPE "TaskSkillImportance" AS ENUM ('REQUIRED', 'IMPORTANT', 'NICE_TO_HAVE');

-- Legacy employee skills without an assessment are conservatively backfilled.
UPDATE "employee_skills"
SET "proficiency" = 'BEGINNER'
WHERE "proficiency" IS NULL;

ALTER TABLE "employee_skills"
  ALTER COLUMN "proficiency" SET NOT NULL;

ALTER TABLE "task_required_skills"
  ADD COLUMN "importance" "TaskSkillImportance" NOT NULL DEFAULT 'IMPORTANT';

UPDATE "task_required_skills"
SET "importance" = CASE
  WHEN "is_required" = true THEN 'REQUIRED'::"TaskSkillImportance"
  WHEN "weight" >= 1.0 THEN 'IMPORTANT'::"TaskSkillImportance"
  ELSE 'NICE_TO_HAVE'::"TaskSkillImportance"
END;

UPDATE "task_required_skills"
SET "required_proficiency" = 'INTERMEDIATE'
WHERE "required_proficiency" IS NULL;

ALTER TABLE "task_required_skills"
  ALTER COLUMN "required_proficiency" SET NOT NULL,
  DROP COLUMN "weight",
  DROP COLUMN "is_required";
