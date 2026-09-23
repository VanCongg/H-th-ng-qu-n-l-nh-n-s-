import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeeSkillsService } from "./employee-skills.service";

describe("EmployeeSkillsService", () => {
  function createService() {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 7, positionId: 2 })
      },
      skill: {
        findFirst: jest.fn().mockResolvedValue({ id: 3 })
      },
      employeeSkill: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 11 }),
        update: jest.fn().mockResolvedValue({ id: 11 })
      }
    };
    const audit = { log: jest.fn() };
    const accessControl = {
      ensureCanUpdateEmployeeSkill: jest.fn(),
      ensureCanReadEmployeeSkill: jest.fn()
    };

    return {
      service: new EmployeeSkillsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService
      ),
      prisma
    };
  }

  const actor = {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["EMPLOYEE_SKILL_UPDATE"],
    employeeId: null,
    mustChangePassword: false
  };

  const dto = { skillId: 3, proficiency: "BEGINNER" } as never;

  it("creates the employee skill when the employee does not have it", async () => {
    const { service, prisma } = createService();

    await service.create(7, dto, actor as never);

    expect(prisma.employeeSkill.create).toHaveBeenCalled();
  });

  it("rejects a skill the employee already has instead of hitting the constraint", async () => {
    const { service, prisma } = createService();
    prisma.employeeSkill.findFirst.mockResolvedValue({ id: 11 });

    await expect(service.create(7, dto, actor as never)).rejects.toMatchObject({
      message: "Employee already has this skill",
      errorCode: "VALIDATION_ERROR"
    });
    expect(prisma.employeeSkill.create).not.toHaveBeenCalled();
  });

  it("still requires the skill to match the employee position", async () => {
    const { service, prisma } = createService();
    prisma.skill.findFirst.mockResolvedValue(null);

    await expect(service.create(7, dto, actor as never)).rejects.toMatchObject({
      message: "Skill is not applicable to employee position"
    });
    expect(prisma.employeeSkill.findFirst).not.toHaveBeenCalled();
  });
});
