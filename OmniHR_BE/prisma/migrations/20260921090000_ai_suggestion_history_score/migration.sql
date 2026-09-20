-- The ranking gained a fourth signal: how the candidate's finished tasks went.
-- Stored per item like the other component scores, so a past suggestion can be
-- explained from the row alone.
ALTER TABLE "ai_task_suggestion_items" ADD COLUMN "history_score" DECIMAL(5,2);
