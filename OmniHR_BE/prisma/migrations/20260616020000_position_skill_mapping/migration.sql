CREATE TABLE "position_skills" (
  "position_id" INTEGER NOT NULL,
  "skill_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "position_skills_pkey" PRIMARY KEY ("position_id", "skill_id")
);

ALTER TABLE "position_skills"
  ADD CONSTRAINT "position_skills_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "position_skills"
  ADD CONSTRAINT "position_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "position_skills" ("position_id", "skill_id")
SELECT p."id", s."id"
FROM "positions" p
JOIN "skills" s ON (
  (p."code" = 'FE_DEV' AND s."code" IN ('REACT', 'TYPESCRIPT', 'UI_UX', 'TESTING', 'DOCKER')) OR
  (p."code" = 'BE_DEV' AND s."code" IN ('NESTJS', 'POSTGRESQL', 'PRISMA', 'TYPESCRIPT', 'DOCKER', 'TESTING')) OR
  (p."code" = 'QA_ENGINEER' AND s."code" IN ('TESTING', 'TYPESCRIPT')) OR
  (p."code" = 'ENG_MANAGER' AND s."code" IN ('TYPESCRIPT', 'DOCKER', 'TESTING')) OR
  (p."code" = 'HR_SPECIALIST' AND s."code" IN ('TESTING'))
)
ON CONFLICT ("position_id", "skill_id") DO NOTHING;
