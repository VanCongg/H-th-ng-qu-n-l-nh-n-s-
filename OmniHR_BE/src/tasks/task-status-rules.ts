import { TaskStatus } from "@prisma/client";

/**
 * Moves the assignee may make on their own work: start it, hand it in for
 * review, and pull it back while it is still in review. Approving (DONE),
 * sending it back, cancelling and reopening are the reviewer's call: the team
 * lead, the department head or an admin.
 */
const ASSIGNEE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW],
  [TaskStatus.IN_REVIEW]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [],
  [TaskStatus.CANCELLED]: []
};

/** Statuses a task can move to from `current`; a reviewer may pick any other one. */
export function allowedTaskStatuses(current: TaskStatus, isReviewer: boolean): TaskStatus[] {
  if (isReviewer) {
    return Object.values(TaskStatus).filter((status) => status !== current);
  }
  return ASSIGNEE_TRANSITIONS[current];
}

export function canMoveTaskStatus(from: TaskStatus, to: TaskStatus, isReviewer: boolean) {
  return from === to || allowedTaskStatuses(from, isReviewer).includes(to);
}

/**
 * The completion time after a status change: stamped when a task becomes DONE,
 * cleared when it leaves DONE, and left alone otherwise, so editing a finished
 * task does not move the day it was finished.
 */
export function completedAtFor(
  from: TaskStatus,
  to: TaskStatus | undefined,
  now = new Date()
): Date | null | undefined {
  if (to === undefined || to === from) {
    return undefined;
  }
  return to === TaskStatus.DONE ? now : null;
}
