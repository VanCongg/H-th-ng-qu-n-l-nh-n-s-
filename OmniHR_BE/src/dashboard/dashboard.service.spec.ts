import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  function createService() {
    const prisma = {
      department: {
        findMany: jest.fn()
      },
      employee: {
        groupBy: jest.fn(),
        count: jest.fn()
      },
      attendanceRecord: {
        count: jest.fn()
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries))
    };
    const accessControl = {};
    const systemSettings = {};

    return {
      service: new DashboardService(
        prisma as unknown as PrismaService,
        accessControl as unknown as AccessControlService,
        systemSettings as unknown as SystemSettingsService
      ),
      prisma
    };
  }

  describe("orgChart", () => {
    it("nests child departments under their parent", async () => {
      const { service, prisma } = createService();
      prisma.department.findMany.mockResolvedValue([
        { id: 1, parentId: null, name: "Engineering" },
        { id: 2, parentId: 1, name: "Backend" },
        { id: 3, parentId: 99, name: "Orphan (unknown parent)" }
      ]);

      const tree = await service.orgChart();

      expect(tree).toHaveLength(2);
      const root = tree.find((node) => node.id === 1);
      expect(root?.children).toHaveLength(1);
      expect(root?.children[0].id).toBe(2);
    });
  });

  describe("orgAnalytics", () => {
    it("computes headcount by department and the attendance rate", async () => {
      const { service, prisma } = createService();
      prisma.department.findMany.mockResolvedValue([
        { id: 1, name: "Engineering" },
        { id: 2, name: "Operations" }
      ]);
      prisma.employee.groupBy.mockResolvedValue([
        { departmentId: 1, _count: 8 },
        { departmentId: 2, _count: 2 }
      ]);
      prisma.employee.count.mockResolvedValue(10);
      prisma.attendanceRecord.count.mockResolvedValue(5);

      const result = await service.orgAnalytics();

      expect(result.totalActiveEmployees).toBe(10);
      expect(result.attendanceRate).toBeCloseTo(0.5);
      expect(result.byDepartment).toEqual([
        { departmentId: 1, departmentName: "Engineering", headcount: 8 },
        { departmentId: 2, departmentName: "Operations", headcount: 2 }
      ]);
    });

    it("returns a 0 attendance rate when there are no active employees", async () => {
      const { service, prisma } = createService();
      prisma.department.findMany.mockResolvedValue([]);
      prisma.employee.groupBy.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);
      prisma.attendanceRecord.count.mockResolvedValue(0);

      const result = await service.orgAnalytics();

      expect(result.attendanceRate).toBe(0);
    });
  });
});
