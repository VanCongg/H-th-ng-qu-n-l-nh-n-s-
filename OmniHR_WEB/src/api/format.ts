import { getCurrentLocale } from "../i18n";

export function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(getCurrentLocale()).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusColor(status?: string) {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
      return "green";
    case "PENDING":
      return "yellow";
    case "REJECTED":
    case "TERMINATED":
      return "red";
    case "CANCELLED":
    case "INACTIVE":
      return "gray";
    default:
      return "blue";
  }
}
