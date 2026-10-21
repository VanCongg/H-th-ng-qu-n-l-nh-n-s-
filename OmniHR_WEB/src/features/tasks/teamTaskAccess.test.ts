import { describe, expect, it } from "vitest";
import type { AuthUser, Project } from "../../api/types";
import { currentMonthRange, teamTaskProjects } from "./teamTaskAccess";

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    username: "user",
    email: "user@example.com",
    roles: ["MANAGER"],
    permissions: ["TASK_CREATE"],
    employeeId: 34,
    mustChangePassword: false,
    ...overrides
  };
}

const projects = [
  // Managed by employee 34, but department 8 is headed by employee 55.
  { id: 1, code: "P1", name: "Clinic", managerId: 34, department: { managerId: 55 } },
  { id: 2, code: "P2", name: "Internal", managerId: 55, department: { managerId: 55 } }
] as Project[];

describe("teamTaskProjects", () => {
  it("does not treat a project manager or team lead as department head", () => {
    expect(teamTaskProjects(projects, user({ employeeId: 34 }))).toEqual([]);
  });

  it("returns the projects in departments the user heads", () => {
    expect(teamTaskProjects(projects, user({ employeeId: 55 })).map((p) => p.id)).toEqual([
      1, 2
    ]);
  });

  it("lets an admin use every project", () => {
    expect(teamTaskProjects(projects, user({ roles: ["ADMIN"], employeeId: null }))).toHaveLength(2);
  });

  it("returns nothing without a user or employee profile", () => {
    expect(teamTaskProjects(projects, null)).toEqual([]);
    expect(teamTaskProjects(projects, user({ employeeId: null }))).toEqual([]);
  });
});

describe("currentMonthRange", () => {
  it("covers the whole calendar month", () => {
    expect(currentMonthRange(new Date(2026, 8, 22))).toEqual({
      fromDate: "2026-09-01",
      toDate: "2026-09-30"
    });
  });

  it("ends a leap February on the 29th", () => {
    expect(currentMonthRange(new Date(2028, 1, 10)).toDate).toBe("2028-02-29");
  });

  it("does not spill into the next year in December", () => {
    expect(currentMonthRange(new Date(2026, 11, 31))).toEqual({
      fromDate: "2026-12-01",
      toDate: "2026-12-31"
    });
  });
});
