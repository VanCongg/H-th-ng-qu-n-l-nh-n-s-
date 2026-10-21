import { TaskStatus } from "@prisma/client";
import { allowedTaskStatuses, canMoveTaskStatus, completedAtFor } from "./task-status-rules";

describe("task status rules", () => {
  it("lets the assignee start, hand in and pull back their work only", () => {
    expect(allowedTaskStatuses(TaskStatus.TODO, false)).toEqual([TaskStatus.IN_PROGRESS]);
    expect(allowedTaskStatuses(TaskStatus.IN_PROGRESS, false)).toEqual([TaskStatus.IN_REVIEW]);
    expect(allowedTaskStatuses(TaskStatus.IN_REVIEW, false)).toEqual([TaskStatus.IN_PROGRESS]);
    expect(allowedTaskStatuses(TaskStatus.DONE, false)).toEqual([]);
    expect(canMoveTaskStatus(TaskStatus.TODO, TaskStatus.DONE, false)).toBe(false);
    expect(canMoveTaskStatus(TaskStatus.IN_REVIEW, TaskStatus.DONE, false)).toBe(false);
    expect(canMoveTaskStatus(TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED, false)).toBe(false);
  });

  it("lets a reviewer approve, cancel and reopen", () => {
    expect(canMoveTaskStatus(TaskStatus.IN_REVIEW, TaskStatus.DONE, true)).toBe(true);
    expect(canMoveTaskStatus(TaskStatus.TODO, TaskStatus.CANCELLED, true)).toBe(true);
    expect(canMoveTaskStatus(TaskStatus.DONE, TaskStatus.IN_PROGRESS, true)).toBe(true);
    expect(allowedTaskStatuses(TaskStatus.DONE, true)).not.toContain(TaskStatus.DONE);
  });

  it("stamps completion only when a task becomes or stops being DONE", () => {
    const now = new Date("2026-09-24T08:00:00.000Z");
    expect(completedAtFor(TaskStatus.IN_REVIEW, TaskStatus.DONE, now)).toBe(now);
    expect(completedAtFor(TaskStatus.DONE, TaskStatus.IN_PROGRESS, now)).toBeNull();
    expect(completedAtFor(TaskStatus.DONE, TaskStatus.DONE, now)).toBeUndefined();
    expect(completedAtFor(TaskStatus.DONE, undefined, now)).toBeUndefined();
  });
});
