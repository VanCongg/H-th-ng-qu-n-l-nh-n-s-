import type { Project, Task, TaskGroup, TaskStatus } from "../../api/types";

/** A team task (level 0) or one of its subtasks (level 1). */
export type TaskTreeRow = Task & {
  rowLevel: 0 | 1;
  rowParent?: Task;
};

/** A team task on the board, with the subtasks it shows and how far along it is. */
export type BoardGroup = {
  root: TaskTreeRow;
  /** The subtasks to list: all of them, or only the matching ones while filtering. */
  children: TaskTreeRow[];
  /** Subtasks left out by the filter, so the UI can say there are more. */
  hiddenCount: number;
  progress: TaskProgress;
};

export type ProjectSection = {
  key: string;
  project: Project | null;
  groups: BoardGroup[];
};

export type TaskProgress = { done: number; total: number };

export function projectGroupKey(project?: { id: number } | null) {
  return project ? `project-${project.id}` : "project-none";
}

/**
 * Lays a page of team tasks out as project > team task > subtask. The API
 * already sorts by project, so projects keep the order their first team task
 * arrived in. While a filter is on, a team task lists just the subtasks that
 * matched, so the match is not buried among the rest; one that matched only
 * by itself (its title, say) lists them all.
 */
export function buildProjectSections(items: TaskGroup[], filtered: boolean): ProjectSection[] {
  const sections = new Map<string, ProjectSection>();
  for (const item of items) {
    const key = projectGroupKey(item.project);
    const section = sections.get(key) ?? { key, project: item.project ?? null, groups: [] };
    const all = item.childTasks ?? [];
    const matched = new Set(item.matchedSubtaskIds ?? []);
    const shown = filtered && matched.size ? all.filter((child) => matched.has(child.id)) : all;
    section.groups.push({
      root: { ...item, rowLevel: 0 },
      children: shown.map((child) => childRow(item, child)),
      hiddenCount: all.length - shown.length,
      progress: taskProgress(all)
    });
    sections.set(key, section);
  }
  return Array.from(sections.values());
}

/** Finished subtasks out of those still counted; a cancelled one drops out of both. */
export function taskProgress(children: Pick<Task, "status">[]): TaskProgress {
  const counted = children.filter((child) => child.status !== "CANCELLED");
  return {
    done: counted.filter((child) => child.status === "DONE").length,
    total: counted.length
  };
}

/** Whether a team task starts open: only while filtering, to show what matched. */
export function isExpanded(taskId: number, filtered: boolean, toggled: ReadonlySet<number>) {
  return filtered !== toggled.has(taskId);
}

export const KANBAN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

/**
 * The subtasks on the page by status, for the Kanban view. Cancelled work has
 * no column: it is off the board, not a stage of it.
 */
export function kanbanColumns(sections: ProjectSection[]): Record<TaskStatus, TaskTreeRow[]> {
  const columns = Object.fromEntries(
    KANBAN_STATUSES.map((status) => [status, [] as TaskTreeRow[]])
  ) as Record<TaskStatus, TaskTreeRow[]>;
  for (const section of sections) {
    for (const group of section.groups) {
      for (const child of group.children) {
        columns[child.status]?.push(child);
      }
    }
  }
  const byDue = (a: Task, b: Task) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  KANBAN_STATUSES.forEach((status) => columns[status].sort(byDue));
  return columns;
}

export type DueTone = "overdue" | "soon" | "normal" | "closed" | "none";

/** How urgent a due date looks today: past, within three days, or fine. */
export function dueTone(task: Pick<Task, "dueDate" | "status">, today: string): DueTone {
  if (!task.dueDate) {
    return "none";
  }
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return "closed";
  }
  const due = task.dueDate.slice(0, 10);
  if (due < today) {
    return "overdue";
  }
  return due <= addDays(today, 3) ? "soon" : "normal";
}

/** Today as YYYY-MM-DD in local time, the way due dates are compared. */
export function localDateKey(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A subtask under its team task, filling what the list payload leaves out. */
export function childRow(parent: Task, child: Task): TaskTreeRow {
  return {
    ...child,
    parentTaskId: child.parentTaskId ?? parent.id,
    parentTask: child.parentTask ?? parent,
    projectId: child.projectId ?? parent.projectId,
    project: child.project ?? parent.project,
    departmentId: child.departmentId ?? parent.departmentId,
    department: child.department ?? parent.department,
    teamId: child.teamId ?? parent.teamId,
    team: child.team ?? parent.team,
    rowLevel: 1,
    rowParent: parent
  };
}
