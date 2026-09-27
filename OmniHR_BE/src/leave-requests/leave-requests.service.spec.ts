import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { HolidaysService } from "../common/services/holidays.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { LeaveBalancesService } from "../leave-balances/leave-balances.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { LeaveRequestsService } from "./leave-requests.service";

const WORK_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

const employee: AuthUser = {
  id: 1,
  username: "nv",
  email: "nv@example.com",
  roles: ["EMPLOYEE"],
  permissions: [],
  employeeId: 10,
  mustChangePassword: false
};

const annual = { id: 1, code: "ANNUAL_LEAVE", isActive: true };
const sick = { id: 2, code: "SICK_LEAVE", isActive: true };

function createService() {
  const prisma = {
    leaveType: { findFirst: jest.fn() },
    leaveRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 99 }),
      update: jest.fn().mockResolvedValue({ id: 99, employee: { userId: null } })
    },
    employeeManager: { findMany: jest.fn().mockResolvedValue([]) }
  };
  const notifications = { create: jest.fn() };
  const accessControl = { ensureCanManageLeave: jest.fn(), isAdmin: jest.fn().mockReturnValue(false) };
  const leaveBalances = { annualBalanceOn: jest.fn() };
  const holidays = { dateSet: jest.fn().mockResolvedValue(new Set<number>()) };
  const service = new LeaveRequestsService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    accessControl as unknown as AccessControlService,
    {
      getSettings: jest.fn().mockResolvedValue({ workWeek: WORK_WEEK, timezoneOffsetMinutes: 420 })
    } as unknown as SystemSettingsService,
    notifications as unknown as NotificationsService,
    leaveBalances as unknown as LeaveBalancesService,
    holidays as unknown as HolidaysService
  );
  return { service, prisma, leaveBalances, holidays, notifications, accessControl };
}

// Mon 5 - Fri 9 October 2026: five working days.
const fiveDays = { leaveTypeId: 1, startDate: "2026-10-05", endDate: "2026-10-09", reason: "Về quê" };

describe("LeaveRequestsService annual leave balance", () => {
  it("refuses annual leave beyond the days still available", async () => {
    const { service, prisma, leaveBalances } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(annual);
    leaveBalances.annualBalanceOn.mockResolvedValue({ availableDays: 2, remainingDays: 4 });

    await expect(service.create(fiveDays, employee)).rejects.toMatchObject({
      errorCode: "LEAVE_BALANCE_INSUFFICIENT"
    });
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("counts the days accrued by the leave itself, not only by today", async () => {
    const { service, prisma, leaveBalances } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(annual);
    leaveBalances.annualBalanceOn.mockResolvedValue({ availableDays: 5, remainingDays: 5 });

    await service.create(fiveDays, employee);

    expect(leaveBalances.annualBalanceOn).toHaveBeenCalledWith(
      10,
      2026,
      new Date(Date.UTC(2026, 9, 9))
    );
    expect(prisma.leaveRequest.create).toHaveBeenCalled();
  });

  it("checks a request over New Year against each year's balance", async () => {
    const { service, prisma, leaveBalances } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(annual);
    // Enough left in 2026, nothing yet in 2027.
    leaveBalances.annualBalanceOn
      .mockResolvedValueOnce({ availableDays: 10, remainingDays: 10 })
      .mockResolvedValueOnce({ availableDays: 0, remainingDays: 0 });

    await expect(
      service.create(
        { ...fiveDays, startDate: "2026-12-30", endDate: "2027-01-04" },
        employee
      )
    ).rejects.toMatchObject({ errorCode: "LEAVE_BALANCE_INSUFFICIENT" });
    expect(leaveBalances.annualBalanceOn).toHaveBeenLastCalledWith(
      10,
      2027,
      new Date(Date.UTC(2027, 0, 4))
    );
  });

  it("does not charge the holidays inside a request", async () => {
    const { service, prisma, leaveBalances, holidays } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(annual);
    // Mon 31 Aug - Fri 4 Sep 2026, over National Day (1-2 Sep).
    holidays.dateSet.mockResolvedValue(
      new Set([Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 2)])
    );
    leaveBalances.annualBalanceOn.mockResolvedValue({ availableDays: 3, remainingDays: 3 });

    await service.create(
      { ...fiveDays, startDate: "2026-08-31", endDate: "2026-09-04" },
      employee
    );

    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalDays: 3 }) })
    );
  });

  it("refuses a request that falls entirely on holidays", async () => {
    const { service, prisma, holidays } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);
    holidays.dateSet.mockResolvedValue(new Set([Date.UTC(2026, 8, 2)]));

    await expect(
      service.create({ ...fiveDays, leaveTypeId: 2, startDate: "2026-09-02", endDate: "2026-09-02" }, employee)
    ).rejects.toMatchObject({ errorCode: "LEAVE_REQUEST_INVALID_DAYS" });
  });

  it("leaves other leave types unlimited", async () => {
    const { service, prisma, leaveBalances } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);

    await service.create({ ...fiveDays, leaveTypeId: 2 }, employee);

    expect(leaveBalances.annualBalanceOn).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.create).toHaveBeenCalled();
  });

  it("re-checks at approval against approved leave only", async () => {
    const { service, prisma, leaveBalances } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 99,
      employeeId: 10,
      status: "PENDING",
      startDate: new Date(Date.UTC(2026, 9, 5)),
      endDate: new Date(Date.UTC(2026, 9, 9)),
      totalDays: 5,
      leaveType: annual
    });
    // Other pending requests would leave 0 available, but only 5 are spoken
    // for by approved leave: this request still fits.
    leaveBalances.annualBalanceOn.mockResolvedValue({ availableDays: 0, remainingDays: 5 });

    await service.approve(99, { ...employee, id: 2, employeeId: 20 });
    expect(prisma.leaveRequest.update).toHaveBeenCalled();

    leaveBalances.annualBalanceOn.mockResolvedValue({ availableDays: 0, remainingDays: 3 });
    prisma.leaveRequest.update.mockClear();
    await expect(service.approve(99, { ...employee, id: 2, employeeId: 20 })).rejects.toMatchObject({
      errorCode: "LEAVE_BALANCE_INSUFFICIENT"
    });
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });
});

describe("LeaveRequestsService half-day leave", () => {
  const friday = { leaveTypeId: 2, startDate: "2026-10-09", endDate: "2026-10-09", reason: "Khám bệnh" };

  it("charges half a day for a morning off", async () => {
    const { service, prisma } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);

    await service.create({ ...friday, halfDay: "MORNING" }, employee);

    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalDays: 0.5, halfDay: "MORNING" })
      })
    );
  });

  it("refuses a half day spread over several days", async () => {
    const { service, prisma } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);

    await expect(
      service.create({ ...fiveDays, leaveTypeId: 2, halfDay: "AFTERNOON" }, employee)
    ).rejects.toMatchObject({ errorCode: "LEAVE_HALF_DAY_RANGE" });
  });

  it("lets the afternoon be taken when only the morning is off", async () => {
    const { service, prisma } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);
    prisma.leaveRequest.findMany.mockResolvedValue([{ halfDay: "MORNING" }]);

    await service.create({ ...friday, halfDay: "AFTERNOON" }, employee);

    expect(prisma.leaveRequest.create).toHaveBeenCalled();
  });

  it("still refuses a half day on a day already fully off", async () => {
    const { service, prisma } = createService();
    prisma.leaveType.findFirst.mockResolvedValue(sick);
    prisma.leaveRequest.findMany.mockResolvedValue([{ halfDay: null }]);

    await expect(
      service.create({ ...friday, halfDay: "AFTERNOON" }, employee)
    ).rejects.toMatchObject({ errorCode: "LEAVE_REQUEST_OVERLAP" });
  });
});

describe("LeaveRequestsService withdrawing approved leave", () => {
  const manager: AuthUser = { ...employee, id: 2, employeeId: 20 };
  const approved = (start: Date, overrides: Record<string, unknown> = {}) => ({
    id: 99,
    employeeId: 10,
    status: "APPROVED",
    approverUserId: 2,
    startDate: start,
    endDate: start,
    totalDays: 1,
    cancelRequestedAt: null,
    employee: { fullName: "Nguyễn Văn A", userId: 1 },
    leaveType: annual,
    ...overrides
  });
  const future = new Date(Date.UTC(2099, 0, 5));

  it("turns the owner's cancel of an approved leave into a request for the manager", async () => {
    const { service, prisma, notifications } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(future));
    prisma.leaveRequest.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...approved(future), ...data })
    );

    const result = await service.cancel(99, employee, undefined, "Hết việc gấp");

    expect(result.status).toBe("APPROVED");
    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cancelRequestedAt: expect.any(Date), cancelRequestReason: "Hết việc gấp" }
      })
    );
    expect(notifications.create).toHaveBeenCalledWith(
      2,
      "LEAVE_CANCEL_REQUESTED",
      "Leave cancellation requested",
      expect.stringContaining("asked to cancel their leave"),
      "LeaveRequest",
      99
    );
  });

  it("refuses to withdraw a leave that has already started", async () => {
    const { service, prisma } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(new Date(Date.UTC(2020, 0, 6))));

    await expect(service.cancel(99, employee)).rejects.toMatchObject({
      errorCode: "LEAVE_ALREADY_STARTED"
    });
  });

  it("does not file the same request twice", async () => {
    const { service, prisma } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(future, { cancelRequestedAt: new Date() }));

    await expect(service.cancel(99, employee)).rejects.toMatchObject({
      errorCode: "LEAVE_CANCEL_ALREADY_REQUESTED"
    });
  });

  it("cancels the leave when the manager accepts, and tells the employee", async () => {
    const { service, prisma, notifications, accessControl } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(future, { cancelRequestedAt: new Date() }));
    prisma.leaveRequest.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...approved(future), ...data })
    );

    const result = await service.approveCancellation(99, manager);

    expect(accessControl.ensureCanManageLeave).toHaveBeenCalledWith(manager, 10);
    expect(result.status).toBe("CANCELLED");
    expect(notifications.create).toHaveBeenCalledWith(
      1,
      "LEAVE_CANCEL_APPROVED",
      "Leave cancellation approved",
      expect.stringMatching(/^Your leave from .+ to .+ was cancelled\.$/),
      "LeaveRequest",
      99
    );
  });

  it("keeps the leave when the manager declines", async () => {
    const { service, prisma, notifications } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(future, { cancelRequestedAt: new Date() }));
    prisma.leaveRequest.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...approved(future), ...data })
    );

    await service.rejectCancellation(99, { rejectionReason: "Dự án cần bạn tuần đó" }, manager);

    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cancelRequestedAt: null, cancelRequestReason: null } })
    );
    expect(notifications.create).toHaveBeenCalledWith(
      1,
      "LEAVE_CANCEL_REJECTED",
      "Leave cancellation rejected",
      "Dự án cần bạn tuần đó",
      "LeaveRequest",
      99
    );
  });

  it("will not decide on a leave nobody asked to cancel", async () => {
    const { service, prisma } = createService();
    prisma.leaveRequest.findUnique.mockResolvedValue(approved(future));

    await expect(service.approveCancellation(99, manager)).rejects.toMatchObject({
      errorCode: "LEAVE_CANCEL_NOT_REQUESTED"
    });
  });
});
