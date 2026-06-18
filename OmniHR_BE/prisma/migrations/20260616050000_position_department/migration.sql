ALTER TABLE "positions"
ADD COLUMN "department_id" INTEGER;

UPDATE "positions" AS p
SET "department_id" = d."id"
FROM "departments" AS d
WHERE d."code" = CASE
  WHEN p."code" IN ('HR_SPECIALIST') THEN 'HR'
  WHEN p."code" IN (
    'IT_MANAGER',
    'ENG_MANAGER',
    'TECH_LEAD',
    'SOFTWARE_ARCHITECT',
    'PRODUCT_OWNER',
    'SCRUM_MASTER',
    'BUSINESS_ANALYST',
    'UI_UX_DESIGNER',
    'FE_DEV',
    'BE_DEV',
    'FULLSTACK_DEV',
    'MOBILE_DEV',
    'QA_ENGINEER',
    'DEVOPS_ENGINEER',
    'DATA_ENGINEER',
    'DATABASE_ADMIN',
    'SECURITY_ENGINEER',
    'SYSTEM_ADMIN',
    'NETWORK_ENGINEER',
    'IT_SUPPORT'
  ) THEN 'IT'
END;

CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

ALTER TABLE "positions"
ADD CONSTRAINT "positions_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
