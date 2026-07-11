import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
  function createService() {
    const prisma = {
      project: {
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };
    const audit = {
      log: jest.fn()
    };
    const accessControl = {
      ensureCanReadProject: jest.fn(),
      isAdmin: jest.fn(() => true)
    };

    return {
      service: new ProjectsService(
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
    permissions: ["PROJECT_UPDATE"],
    employeeId: null,
    mustChangePassword: false
  };

  it("validates updated start date against the existing end date", async () => {
    const { service, prisma } = createService();

    prisma.project.findFirst.mockResolvedValue({
      id: 100,
      departmentId: 2,
      managerId: 10,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-20T00:00:00.000Z")
    });

    await expect(
      service.update(100, { startDate: "2026-07-01" }, actor)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "VALIDATION_ERROR"
      })
    });
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
