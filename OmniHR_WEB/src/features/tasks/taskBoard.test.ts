import { describe, expect, it } from "vitest";
import type { Project, Task, TaskGroup } from "../../api/types";
import {
  buildProjectSections,
  dueTone,
  isExpanded,
  kanbanColumns,
  taskProgress
} from "./taskBoard";

const alpha = { id: 1, code: "ALPHA", name: "Alpha" } as Project;
const beta = { id: 2, code: "BETA", name: "Beta" } as Project;

function task(overrides: Partial<Task>): Task {
  return { status: "TODO", priority: "MEDIUM", title: "", technologies: [], ...overrides } as Task;
}

function group(overrides: Partial<TaskGroup>): TaskGroup {
  return { matchedSelf: true, matchedSubtaskIds: [], childTasks: [], ...task(overrides), ...overrides } as TaskGroup;
}

describe("buildProjectSections", () => {
  const login = group({
    id: 10,
    title: "Login",
    project: alpha,
    childTasks: [
      task({ id: 11, title: "API", status: "DONE" }),
      task({ id: 12, title: "Form", status: "IN_REVIEW" }),
      task({ id: 13, title: "Docs", status: "CANCELLED" })
    ]
  });
  const report = group({ id: 20, title: "Report", project: beta });
  const signup = group({ id: 30, title: "Signup", project: alpha });

  it("groups team tasks under their project in the order they arrived", () => {
    const sections = buildProjectSections([login, report, signup], false);

    expect(sections.map((section) => section.key)).toEqual(["project-1", "project-2"]);
    expect(sections[0].groups.map((item) => item.root.id)).toEqual([10, 30]);
  });

  it("fills a subtask's project and team task from above", () => {
    const [section] = buildProjectSections([login], false);
    const child = section.groups[0].children[0];

    expect(child.rowLevel).toBe(1);
    expect(child.project?.code).toBe("ALPHA");
    expect(child.rowParent?.id).toBe(10);
  });

  it("while filtering, lists only the subtasks that matched", () => {
    const matched = { ...login, matchedSelf: false, matchedSubtaskIds: [12] };

    const [section] = buildProjectSections([matched], true);

    expect(section.groups[0].children.map((child) => child.id)).toEqual([12]);
    expect(section.groups[0].hiddenCount).toBe(2);
  });

  it("lists every subtask of a team task that matched only by itself", () => {
    const [section] = buildProjectSections([{ ...login, matchedSelf: true, matchedSubtaskIds: [] }], true);

    expect(section.groups[0].children).toHaveLength(3);
    expect(section.groups[0].hiddenCount).toBe(0);
  });

  it("measures progress on every subtask, not only the ones shown", () => {
    const matched = { ...login, matchedSelf: false, matchedSubtaskIds: [12] };

    const [section] = buildProjectSections([matched], true);

    expect(section.groups[0].progress).toEqual({ done: 1, total: 2 });
  });
});

describe("taskProgress", () => {
  it("leaves cancelled work out of the total", () => {
    expect(taskProgress([{ status: "DONE" }, { status: "CANCELLED" }, { status: "TODO" }])).toEqual({
      done: 1,
      total: 2
    });
  });
});

describe("isExpanded", () => {
  it("starts closed, and open while filtering; a click flips either", () => {
    expect(isExpanded(1, false, new Set())).toBe(false);
    expect(isExpanded(1, true, new Set())).toBe(true);
    expect(isExpanded(1, false, new Set([1]))).toBe(true);
    expect(isExpanded(1, true, new Set([1]))).toBe(false);
  });
});

describe("kanbanColumns", () => {
  it("puts subtasks in their status column by due date and leaves cancelled ones off", () => {
    const sections = buildProjectSections(
      [
        group({
          id: 10,
          project: alpha,
          childTasks: [
            task({ id: 11, status: "TODO", dueDate: "2026-10-05" }),
            task({ id: 12, status: "TODO", dueDate: "2026-09-30" }),
            task({ id: 13, status: "CANCELLED" })
          ]
        })
      ],
      false
    );

    const columns = kanbanColumns(sections);

    expect(columns.TODO.map((item) => item.id)).toEqual([12, 11]);
    expect(Object.values(columns).flat()).toHaveLength(2);
  });
});

describe("dueTone", () => {
  const today = "2026-09-27";

  it("flags unfinished work past its date and work due within three days", () => {
    expect(dueTone({ status: "IN_PROGRESS", dueDate: "2026-09-26T00:00:00.000Z" }, today)).toBe("overdue");
    expect(dueTone({ status: "TODO", dueDate: "2026-09-30T00:00:00.000Z" }, today)).toBe("soon");
    expect(dueTone({ status: "TODO", dueDate: "2026-10-01T00:00:00.000Z" }, today)).toBe("normal");
  });

  it("never flags finished work", () => {
    expect(dueTone({ status: "DONE", dueDate: "2026-09-01T00:00:00.000Z" }, today)).toBe("closed");
  });
});
