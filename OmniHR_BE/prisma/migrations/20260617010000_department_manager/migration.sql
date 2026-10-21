ALTER TABLE "departments" ADD COLUMN "manager_id" INTEGER;

CREATE INDEX "departments_manager_id_idx" ON "departments"("manager_id");

ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
