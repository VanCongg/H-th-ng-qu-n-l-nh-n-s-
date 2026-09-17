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
