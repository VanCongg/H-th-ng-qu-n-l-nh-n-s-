import type { AuthUser, Project } from "../../api/types";

/**
 * Projects the user may create a team-level task in. Mirrors the backend rule
 * in `TasksService`: only an admin or the head (`Department.managerId`) of the
 * project's department qualifies — being the project manager or a team lead
 * is not enough.
 */
export function teamTaskProjects(
  projects: Project[],
  user: AuthUser | null | undefined
): Project[] {
  if (!user) return [];
  if (user.roles.includes("ADMIN")) return projects;
  if (user.employeeId == null) return [];
  return projects.filter(
    (project) => project.department?.managerId === user.employeeId
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The team board's default window: tasks due this calendar month (local time),
 * sent with `includeOpen` so unfinished work from earlier months stays on it.
 * Only finished work from past months drops off.
 */
export function currentMonthRange(today: Date = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    fromDate: `${year}-${pad(month + 1)}-01`,
    toDate: `${year}-${pad(month + 1)}-${pad(lastDay)}`
  };
}
