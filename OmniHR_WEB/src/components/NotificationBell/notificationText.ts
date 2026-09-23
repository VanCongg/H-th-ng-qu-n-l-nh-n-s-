import type { AppLanguage } from "../../store/preferences";

/**
 * The server writes notification titles and messages in English and stores
 * them that way. These rebuild them in Vietnamese: the title from the stable
 * `type`, the message from the fixed sentence each type is written with. Doing
 * it at render time also covers every row already in the database.
 *
 * The sentences come from, and must keep these exact shapes in:
 *   TASK_ASSIGNED        tasks.service.ts, seed.ts, simulate-day.ts
 *   TASK_STATUS_CHANGED  simulate-day.ts
 *   LEAVE_APPROVED       leave-requests.service.ts, seed.ts, simulate-day.ts
 *   ATTENDANCE_ADJUSTED  attendance.service.ts
 * A message that does not match (a rejection reason, a reworded sentence) is
 * shown as stored, so drift degrades to English rather than to garbled text.
 * The mobile app does the same in lib/core/utils.dart.
 */

const TITLES: Record<string, string> = {
  LEAVE_APPROVED: "Đơn nghỉ phép đã được duyệt",
  LEAVE_REJECTED: "Đơn nghỉ phép bị từ chối",
  TASK_ASSIGNED: "Bạn được giao công việc mới",
  // Only ever emitted for a task sent back for rework; widen if that changes.
  TASK_STATUS_CHANGED: "Công việc bị trả về để sửa",
  ATTENDANCE_ADJUSTED: "Bản ghi chấm công được điều chỉnh"
};

const ASSIGNED = /^You were assigned to "(.+)"\.$/s;
const REWORK = /^"(.+)" needs changes before it can be accepted\.$/s;
const LEAVE_APPROVED = /^Your leave request from (.+) to (.+) was approved\.$/;
const ATTENDANCE = /^An attendance record for (.+) was (created|updated) by an admin\.$/;

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A date as the server wrote it into a message — `2026-09-21` from the
 * simulator, or JavaScript's `toDateString()` form `Mon Sep 21 2026` from the
 * API and the seed — as dd/MM/yyyy. Anything else is passed through.
 */
export function messageDate(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 4) {
    const month = MONTHS[parts[1]];
    const day = Number(parts[2]);
    const year = Number(parts[3]);
    if (month && Number.isInteger(day) && Number.isInteger(year)) {
      return `${pad(day)}/${pad(month)}/${year}`;
    }
  }
  return raw;
}

export function notificationTitle(
  language: AppLanguage,
  type: string,
  title: string
): string {
  if (language !== "vi") {
    return title;
  }
  return TITLES[type.toUpperCase()] ?? title;
}

export function notificationMessage(
  language: AppLanguage,
  type: string,
  message: string
): string {
  if (language !== "vi") {
    return message;
  }

  let match: RegExpExecArray | null;
  switch (type.toUpperCase()) {
    case "TASK_ASSIGNED":
      if ((match = ASSIGNED.exec(message))) {
        return `Bạn được giao công việc "${match[1]}".`;
      }
      break;
    case "TASK_STATUS_CHANGED":
      if ((match = REWORK.exec(message))) {
        return `Công việc "${match[1]}" cần chỉnh sửa trước khi được duyệt.`;
      }
      break;
    case "LEAVE_APPROVED":
      if ((match = LEAVE_APPROVED.exec(message))) {
        return `Đơn nghỉ phép từ ${messageDate(match[1])} đến ${messageDate(
          match[2]
        )} của bạn đã được duyệt.`;
      }
      break;
    case "ATTENDANCE_ADJUSTED":
      if ((match = ATTENDANCE.exec(message))) {
        const date = messageDate(match[1]);
        return match[2] === "created"
          ? `Quản trị viên đã thêm bản ghi chấm công ngày ${date}.`
          : `Quản trị viên đã sửa bản ghi chấm công ngày ${date}.`;
      }
      break;
  }
  return message;
}
