// Luật chuyển trạng thái task.
// Người được giao chỉ được: TODO -> IN_PROGRESS -> IN_REVIEW, và rút IN_REVIEW về IN_PROGRESS.
// Duyệt hoàn thành (DONE), trả lại, hủy, mở lại là việc của người duyệt: trưởng nhóm, trưởng phòng hoặc admin.

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
// Các trạng thái được phép chuyển tới; người duyệt được chọn bất kỳ trạng thái nào khác.
export function allowedTaskStatuses(current: TaskStatus, isReviewer: boolean): TaskStatus[] {
  if (isReviewer) {
    return Object.values(TaskStatus).filter((status) => status !== current);
  }
  return ASSIGNEE_TRANSITIONS[current];
}

// Có được chuyển từ trạng thái này sang trạng thái kia không.
export function canMoveTaskStatus(from: TaskStatus, to: TaskStatus, isReviewer: boolean) {
  return from === to || allowedTaskStatuses(from, isReviewer).includes(to);
}

/**
 * The completion time after a status change: stamped when a task becomes DONE,
 * cleared when it leaves DONE, and left alone otherwise, so editing a finished
 * task does not move the day it was finished.
 */
// Thời điểm hoàn thành: đặt khi chuyển sang DONE, xóa khi rời DONE, còn lại giữ nguyên.
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
