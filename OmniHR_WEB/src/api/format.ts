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

export function formatEmployeeJobTitle(
  employee?: Pick<Employee, "careerLevel" | "position"> | null,
  translateEnum?: (value?: string | null) => string
) {
  if (!employee) {
    return "-";
  }
  const title = [
    formatCareerLevel(employee.careerLevel, translateEnum),
    employee.position?.name
  ].filter(Boolean);
  return title.length ? title.join(" ") : "-";
}

export function formatDepartmentName(
  department?: Pick<Department, "code" | "name"> | null,
  translateText?: (text?: string | null) => string
) {
  if (!department) {
    return "-";
  }
  const canonicalNames: Record<string, string> = {
    ENG: "Engineering",
    IT: "Information Technology",
    OPS: "Operations",
    HR: "Human Resources"
  };
  const source = canonicalNames[department.code] ?? department.name;
  return translateText?.(source) || source || "-";
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
