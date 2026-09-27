-- The career levels a task suits; ranking favours people inside the range.
ALTER TABLE "tasks"
    ADD COLUMN "max_level" "CareerLevel",
    ADD COLUMN "min_level" "CareerLevel";
