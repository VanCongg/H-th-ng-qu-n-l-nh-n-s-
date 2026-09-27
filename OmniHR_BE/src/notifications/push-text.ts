/**
 * Notifications are stored in English and translated where they are shown
 * (OmniHR_WEB notificationText.ts, OmniHR_APP lib/core/utils.dart). A push
 * message is shown by the phone itself, before the app runs, so its text has
 * to be written here in the language the device registered with. The sentence
 * shapes are the same ones those two files match; keep all three in step.
 */

export type PushLanguage = "vi" | "en";

const TITLES_VI: Record<string, string> = {
  LEAVE_APPROVED: "Đơn nghỉ phép đã được duyệt",
  LEAVE_REJECTED: "Đơn nghỉ phép bị từ chối",
  LEAVE_CANCEL_REQUESTED: "Có yêu cầu hủy đơn nghỉ đã duyệt",
  LEAVE_CANCEL_APPROVED: "Đơn nghỉ đã được hủy",
  LEAVE_CANCEL_REJECTED: "Yêu cầu hủy đơn nghỉ bị từ chối",
  TASK_ASSIGNED: "Bạn được giao công việc mới",
  TASK_STATUS_CHANGED: "Công việc bị trả về để sửa",
  ATTENDANCE_ADJUSTED: "Bản ghi chấm công được điều chỉnh"
};

const TASK_STATUS_VI: Record<string, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  IN_REVIEW: "Đang review",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy"
};

const ASSIGNED = /^You were assigned to "(.+)"\.$/s;
const REWORK = /^"(.+)" needs changes before it can be accepted\.$/s;
const STATUS_MOVED = /^"(.+)" was moved to ([A-Z_]+) by (.+)\.$/s;
const LEAVE_APPROVED = /^Your leave request from (.+) to (.+) was approved\.$/;
const ATTENDANCE = /^An attendance record for (.+) was (created|updated) by an admin\.$/;
const CANCEL_REQUESTED = /^(.+) asked to cancel their leave from (.+) to (.+)\.$/s;
const CANCEL_APPROVED = /^Your leave from (.+) to (.+) was cancelled\.$/;

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

const pad = (value: number) => String(value).padStart(2, "0");

/** `2026-09-21` or `Mon Sep 21 2026` as dd/MM/yyyy; anything else as given. */
function messageDate(raw: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const parts = raw.trim().split(/\s+/);
  const month = parts.length === 4 ? MONTHS[parts[1]] : undefined;
  if (month) {
    return `${pad(Number(parts[2]))}/${pad(month)}/${parts[3]}`;
  }
  return raw;
}

export function pushText(
  language: PushLanguage,
  notification: { type: string; title: string; message: string }
): { title: string; body: string } {
  const { type, title, message } = notification;
  if (language !== "vi") {
    return { title, body: message };
  }

  let body = message;
  let match: RegExpExecArray | null;
  if (type === "TASK_ASSIGNED" && (match = ASSIGNED.exec(message))) {
    body = `Bạn được giao công việc "${match[1]}".`;
  } else if (type === "TASK_STATUS_CHANGED" && (match = REWORK.exec(message))) {
    body = `Công việc "${match[1]}" cần chỉnh sửa trước khi được duyệt.`;
  } else if (type === "TASK_STATUS_CHANGED" && (match = STATUS_MOVED.exec(message))) {
    body = `${match[3]} đã chuyển công việc "${match[1]}" sang "${TASK_STATUS_VI[match[2]] ?? match[2]}".`;
  } else if (type === "LEAVE_APPROVED" && (match = LEAVE_APPROVED.exec(message))) {
    body = `Đơn nghỉ phép từ ${messageDate(match[1])} đến ${messageDate(match[2])} của bạn đã được duyệt.`;
  } else if (type === "LEAVE_CANCEL_REQUESTED" && (match = CANCEL_REQUESTED.exec(message))) {
    body = `${match[1]} xin hủy đơn nghỉ từ ${messageDate(match[2])} đến ${messageDate(match[3])}.`;
  } else if (type === "LEAVE_CANCEL_APPROVED" && (match = CANCEL_APPROVED.exec(message))) {
    body = `Đơn nghỉ từ ${messageDate(match[1])} đến ${messageDate(match[2])} của bạn đã được hủy.`;
  } else if (type === "ATTENDANCE_ADJUSTED" && (match = ATTENDANCE.exec(message))) {
    const date = messageDate(match[1]);
    body =
      match[2] === "created"
        ? `Quản trị viên đã thêm bản ghi chấm công ngày ${date}.`
        : `Quản trị viên đã sửa bản ghi chấm công ngày ${date}.`;
  }

  const localizedTitle =
    type === "TASK_STATUS_CHANGED" && title === "Task status updated"
      ? "Trạng thái công việc được cập nhật"
      : (TITLES_VI[type] ?? title);
  return { title: localizedTitle, body };
}
