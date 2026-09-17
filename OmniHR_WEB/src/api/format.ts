import { getCurrentLocale } from "../i18n";
import type { CareerLevel, Department, Employee, Team } from "./types";

export const careerLevels: CareerLevel[] = [
  "INTERN",
  "FRESHER",
  "JUNIOR",
  "MIDDLE",
  "SENIOR",
  "LEAD"
];

const careerLevelLabels: Record<CareerLevel, string> = {
  INTERN: "Intern",
  FRESHER: "Fresher",
  JUNIOR: "Junior",
  MIDDLE: "Middle",
  SENIOR: "Senior",
  LEAD: "Lead"
};

export function formatCareerLevel(
  value?: CareerLevel | null,
  translateEnum?: (value?: string | null) => string
) {
  if (!value) {
    return "";
  }
  const translated = translateEnum?.(value);
  return translated && translated !== value ? translated : careerLevelLabels[value];
}

export function careerLevelOptions(
  translateEnum?: (value?: string | null) => string
) {
  return careerLevels.map((value) => ({
    value,
    label: formatCareerLevel(value, translateEnum)
  }));
}

/** The position name alone; the career level is shown separately. */
export function formatPositionName(employee?: Pick<Employee, "position"> | null) {
  return employee?.position?.name || "-";
}

export function formatDepartmentName(
  department?: Pick<Department, "code" | "name"> | null,
  translateText?: (text?: string | null) => string
) {
  if (!department) {
    return "-";
  }
  // The stored name is what admins typed; replacing it by code showed
  // "Operations" for "Hành chính - Vận hành".
  return translateText?.(department.name) || department.name || "-";
}

export function formatTeamName(team?: Pick<Team, "code" | "name"> | null) {
  if (!team) {
    return "-";
  }
  return `${team.code} - ${team.name}`;
}

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
    case "COMPLETED":
    case "DONE":
    case "SELECTED":
      return "green";
    case "PENDING":
    case "PLANNING":
    case "IN_REVIEW":
      return "yellow";
    case "REJECTED":
    case "TERMINATED":
    case "URGENT":
      return "red";
    case "CANCELLED":
    case "INACTIVE":
    case "EXPIRED":
      return "gray";
    case "ON_HOLD":
    case "IN_PROGRESS":
      return "orange";
    default:
      return "blue";
  }
}

export function formatMoney(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat(getCurrentLocale(), {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

/** Minutes as "1h05" or "45m"; zero stays "0". */
export function formatMinutes(minutes: number) {
  if (!minutes) {
    return "0";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${String(rest).padStart(2, "0")}` : `${rest}m`;
}

/** Work days, which are whole or half days. */
export function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatMonthYear(value: { month: number; year: number }) {
  return `${String(value.month).padStart(2, "0")}/${value.year}`;
}

export function monthOptions(prefix: string) {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: `${prefix} ${index + 1}`
  }));
}

export function yearOptions(currentYear = new Date().getFullYear()) {
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(
    (year) => ({ value: String(year), label: String(year) })
  );
}
