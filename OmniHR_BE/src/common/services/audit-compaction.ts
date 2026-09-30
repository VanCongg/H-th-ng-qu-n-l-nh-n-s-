/**
 * What an audit row keeps of the values a service hands it.
 *
 * Services log whole records - a task with its team, the team's members,
 * their departments - so a single edit could store several kilobytes of
 * which one field changed. A record (anything with an `id`) keeps only its own
 * plain fields, never the related records hanging off it; and when both the
 * before and after of a record are given, only the fields that changed. Small
 * hand-built payloads ({ assigneeId, assignmentType }) pass through as they are.
 *
 * The migration 20260927134042_audit_log_compaction applies the same rule to
 * rows written before this existed; keep the two in step.
 */
export function compactAuditValues(oldValue: unknown, newValue: unknown) {
  const before = toJson(oldValue);
  const after = toJson(newValue);
  if (isRecord(before) && isRecord(after)) {
    const flatBefore = ownFields(before);
    const flatAfter = ownFields(after);
    return {
      oldValue: changedFields(flatBefore, flatAfter),
      newValue: changedFields(flatAfter, flatBefore)
    };
  }
  return {
    oldValue: isRecord(before) ? ownFields(before) : before,
    newValue: isRecord(after) ? ownFields(after) : after
  };
}

/** Changed on every save, so it says nothing about what the save changed. */
const IGNORED_IN_DIFF = new Set(["updatedAt"]);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function toJson(value: unknown): Json | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as Json);
}

function isRecord(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "id" in value;
}

/** A value that belongs to the record itself: a scalar, or a list of scalars (tags, ids). */
function isOwnField(value: Json) {
  if (value === null || typeof value !== "object") {
    return true;
  }
  return Array.isArray(value) && value.every((item) => item === null || typeof item !== "object");
}

function ownFields(record: { [key: string]: Json }) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => isOwnField(value)));
}

function changedFields(side: { [key: string]: Json }, other: { [key: string]: Json }) {
  return Object.fromEntries(
    Object.entries(side).filter(
      ([key, value]) => !IGNORED_IN_DIFF.has(key) && JSON.stringify(other[key]) !== JSON.stringify(value)
    )
  );
}
