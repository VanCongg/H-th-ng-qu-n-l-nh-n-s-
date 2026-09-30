import { compactAuditValues } from "./audit-compaction";

describe("compactAuditValues", () => {
  const task = {
    id: 7,
    title: "Build login",
    status: "TODO",
    technologies: ["React", "NestJS"],
    updatedAt: "2026-09-01T00:00:00.000Z",
    team: { id: 2, name: "Web", members: [{ id: 1, employee: { id: 5 } }] },
    requiredSkills: [{ id: 3, skillId: 9 }]
  };

  it("keeps a created record's own fields and drops the records hanging off it", () => {
    const { newValue } = compactAuditValues(undefined, task);

    expect(newValue).toEqual({
      id: 7,
      title: "Build login",
      status: "TODO",
      technologies: ["React", "NestJS"],
      updatedAt: "2026-09-01T00:00:00.000Z"
    });
  });

  it("keeps only what an edit changed, on both sides", () => {
    const edited = { ...task, status: "IN_PROGRESS", updatedAt: "2026-09-02T00:00:00.000Z" };

    expect(compactAuditValues(task, edited)).toEqual({
      oldValue: { status: "TODO" },
      newValue: { status: "IN_PROGRESS" }
    });
  });

  it("notices a changed list of tags", () => {
    const edited = { ...task, technologies: ["React"] };

    expect(compactAuditValues(task, edited).newValue).toEqual({ technologies: ["React"] });
  });

  it("leaves a small hand-built payload as it is", () => {
    const payload = { assigneeId: 5, assignmentType: "MANUAL", arguments: { days: 7 } };

    expect(compactAuditValues({ assigneeId: null }, payload)).toEqual({
      oldValue: { assigneeId: null },
      newValue: payload
    });
  });

  it("turns dates into the strings a JSON column stores", () => {
    const { newValue } = compactAuditValues(undefined, { id: 1, at: new Date("2026-09-27T00:00:00.000Z") });

    expect(newValue).toEqual({ id: 1, at: "2026-09-27T00:00:00.000Z" });
  });
});
