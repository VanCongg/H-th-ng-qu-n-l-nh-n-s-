import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { TaskWorkloadService } from "./task-workload.service";

describe("TaskWorkloadService", () => {
  function createService() {
    const prisma = { task: { findMany: jest.fn() } };
    const service = new TaskWorkloadService(
      prisma as unknown as PrismaService,
      {} as AccessControlService,
      {
        getSettings: jest.fn().mockResolvedValue({ timezoneOffsetMinutes: 420 })
      } as unknown as SystemSettingsService
    );
    return { service, prisma };
  }

  it("reads everyone's open tasks in one query and splits them per person", async () => {
    const { service, prisma } = createService();
    const farDue = new Date(Date.UTC(2099, 0, 1));
    prisma.task.findMany.mockResolvedValue([
      { assigneeId: 1, status: "IN_PROGRESS", estimatedHours: 8, actualHours: 2, startDate: null, dueDate: null },
      { assigneeId: 1, status: "IN_REVIEW", estimatedHours: 20, actualHours: 20, startDate: null, dueDate: null },
      { assigneeId: 2, status: "TODO", estimatedHours: 4, actualHours: null, startDate: null, dueDate: farDue }
    ]);

    const summaries = await service.summariesForEmployees([1, 2, 3]);

    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.task.findMany.mock.calls[0][0].where.assigneeId).toEqual({ in: [1, 2, 3] });
    // Six hours left this week; work handed in for review adds none.
    expect(summaries.get(1)).toMatchObject({ activeTaskCount: 2, weeklyLoadHours: 6, totalEstimatedHours: 6 });
    expect(summaries.get(2)?.activeTaskCount).toBe(1);
    // Someone with nothing open still gets a row.
    expect(summaries.get(3)).toMatchObject({ activeTaskCount: 0, weeklyLoadHours: 0, availableHours: 40 });
  });

  it("does not query for nobody", async () => {
    const { service, prisma } = createService();

    await expect(service.summariesForEmployees([])).resolves.toEqual(new Map());
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});
