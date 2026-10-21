CREATE TYPE "CareerLevel" AS ENUM ('INTERN', 'JUNIOR', 'MIDDLE', 'SENIOR', 'LEAD');

ALTER TABLE "employees"
ADD COLUMN "career_level" "CareerLevel" NOT NULL DEFAULT 'MIDDLE';

UPDATE "employees" AS e
SET "career_level" = CASE COALESCE(p."level", 3)
  WHEN 1 THEN 'INTERN'::"CareerLevel"
  WHEN 2 THEN 'JUNIOR'::"CareerLevel"
  WHEN 3 THEN 'MIDDLE'::"CareerLevel"
  WHEN 4 THEN 'SENIOR'::"CareerLevel"
  WHEN 5 THEN 'LEAD'::"CareerLevel"
  ELSE 'MIDDLE'::"CareerLevel"
END
FROM "positions" AS p
WHERE e."position_id" = p."id";

ALTER TABLE "positions"
DROP COLUMN "level";
