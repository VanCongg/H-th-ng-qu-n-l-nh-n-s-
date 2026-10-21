-- One email per person. The address people have been using - the one their
-- account signs in with - becomes their personal email; the old secondary
-- personal addresses are dropped, and so is the company email column.
UPDATE "employees" SET "personal_email" = "company_email";

ALTER TABLE "employees" ALTER COLUMN "personal_email" SET NOT NULL;

-- DropIndex
DROP INDEX "employees_company_email_key";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "company_email";

-- CreateIndex
CREATE UNIQUE INDEX "employees_personal_email_key" ON "employees"("personal_email");
