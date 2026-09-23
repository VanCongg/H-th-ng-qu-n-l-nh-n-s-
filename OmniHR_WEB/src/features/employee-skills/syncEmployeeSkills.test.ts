import { beforeEach, describe, expect, it, vi } from "vitest";
import { employeeSkillsApi } from "../../api/endpoints";
import { DEFAULT_SKILL_PROFICIENCY, syncEmployeeSkills } from "./syncEmployeeSkills";

vi.mock("../../api/endpoints", () => ({
  employeeSkillsApi: {
    list: vi.fn(),
    create: vi.fn(),
    remove: vi.fn()
  }
}));

const api = vi.mocked(employeeSkillsApi);

describe("syncEmployeeSkills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([]);
    api.create.mockResolvedValue({} as never);
    api.remove.mockResolvedValue({} as never);
  });

  it("sends a proficiency with every skill it adds", async () => {
    await syncEmployeeSkills(7, [3]);

    // The backend requires it; omitting it used to fail the whole save.
    expect(api.create).toHaveBeenCalledWith(7, {
      skillId: 3,
      proficiency: DEFAULT_SKILL_PROFICIENCY
    });
  });

  it("only adds the skills the employee does not have yet", async () => {
    api.list.mockResolvedValue([
      { id: 11, employeeId: 7, skillId: 3, proficiency: "EXPERT" } as never
    ]);

    await syncEmployeeSkills(7, [3, 4]);

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(7, {
      skillId: 4,
      proficiency: DEFAULT_SKILL_PROFICIENCY
    });
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("removes the skills that are no longer selected", async () => {
    api.list.mockResolvedValue([
      { id: 11, employeeId: 7, skillId: 3, proficiency: "EXPERT" } as never,
      { id: 12, employeeId: 7, skillId: 4, proficiency: "BEGINNER" } as never
    ]);

    await syncEmployeeSkills(7, [3]);

    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(api.remove).toHaveBeenCalledWith(12);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("writes nothing when the selection already matches", async () => {
    api.list.mockResolvedValue([
      { id: 11, employeeId: 7, skillId: 3, proficiency: "EXPERT" } as never
    ]);

    await syncEmployeeSkills(7, [3, 3]);

    expect(api.create).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("adds a duplicated selection only once", async () => {
    await syncEmployeeSkills(7, [5, 5]);

    expect(api.create).toHaveBeenCalledTimes(1);
  });
});
