-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Check-ins and check-outs are no longer audited: the attendance record is the
-- record of a punch. Drop the copies already written.
DELETE FROM "audit_logs" WHERE "action" IN ('CHECK_IN', 'CHECK_OUT');

-- Rows written before AuditService compacted its values, compacted the same way
-- (see src/common/services/audit-compaction.ts): a record - a JSON object with
-- an "id" - keeps only its own scalar fields and lists of scalars, and when
-- both the before and after are records, only the fields that changed.
CREATE FUNCTION pg_temp.audit_own_fields(value jsonb) RETURNS jsonb AS $$
  SELECT COALESCE(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
  FROM jsonb_each(value) AS field
  WHERE jsonb_typeof(field.value) <> 'object'
    AND (
      jsonb_typeof(field.value) <> 'array'
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(field.value) AS item
        WHERE jsonb_typeof(item) IN ('object', 'array')
      )
    )
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.audit_changed(side jsonb, other jsonb) RETURNS jsonb AS $$
  SELECT COALESCE(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
  FROM jsonb_each(side) AS field
  WHERE field.key <> 'updatedAt'
    AND (other -> field.key) IS DISTINCT FROM field.value
$$ LANGUAGE sql IMMUTABLE;

-- Before and after both records: keep what changed.
UPDATE "audit_logs"
SET "old_value" = pg_temp.audit_changed(pg_temp.audit_own_fields("old_value"), pg_temp.audit_own_fields("new_value")),
    "new_value" = pg_temp.audit_changed(pg_temp.audit_own_fields("new_value"), pg_temp.audit_own_fields("old_value"))
WHERE jsonb_typeof("old_value") = 'object' AND "old_value" ? 'id'
  AND jsonb_typeof("new_value") = 'object' AND "new_value" ? 'id';

-- One side a record: keep its own fields.
UPDATE "audit_logs"
SET "new_value" = pg_temp.audit_own_fields("new_value")
WHERE jsonb_typeof("new_value") = 'object' AND "new_value" ? 'id';

UPDATE "audit_logs"
SET "old_value" = pg_temp.audit_own_fields("old_value")
WHERE jsonb_typeof("old_value") = 'object' AND "old_value" ? 'id';
