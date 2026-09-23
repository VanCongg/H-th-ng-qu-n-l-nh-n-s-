import {
  AttendanceRecordType,
  AttendanceShift,
  AttendanceStatus
} from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import {
  defaultSystemSettings,
  SystemSettingsService
} from "../common/services/system-settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AttendanceService } from "./attendance.service";

describe("AttendanceService", () => {
  function createService(settingsOverrides: Record<string, unknown> = {}) {
    const prisma = {
      attendanceRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => Promise.resolve({ id: 1, ...data }))
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma))
    };
    const audit = { log: jest.fn() };
    const systemSettings = {
      getSettings: jest
        .fn()
        .mockResolvedValue({ ...defaultSystemSettings, ...settingsOverrides })
    };

    return {
      service: new AttendanceService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        {} as AccessControlService,
        systemSettings as unknown as SystemSettingsService,
        {} as NotificationsService
      ),
      prisma
    };
  }

  const employee = {
    id: 7,
    username: "employee",
    email: "employee@example.com",
    roles: ["EMPLOYEE"],
    permissions: ["ATTENDANCE_CHECK_IN"],
    employeeId: 42,
    mustChangePassword: false
  };
  const location = { latitude: 21.02776, longitude: 105.83416 };

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records a check-in outside every shift with its time and no shift status", async () => {
    // 14:00 UTC is 21:00 in the default UTC+7 timezone, after both shifts.
    const now = new Date("2026-09-14T14:00:00Z");
    jest.useFakeTimers().setSystemTime(now);
    const { service, prisma } = createService();

    await service.checkIn(employee, location);

    expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 42,
          recordedAt: now,
          shift: null,
          attendanceStatus: null
        })
      })
    );
  });

  it("still marks a check-in inside a shift as late or on time", async () => {
    // 01:30 UTC is 08:30 local, 30 minutes into the morning shift.
    jest.useFakeTimers().setSystemTime(new Date("2026-09-14T01:30:00Z"));
    const { service, prisma } = createService();

    await service.checkIn(employee, location);

    expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shift: AttendanceShift.MORNING,
          attendanceStatus: AttendanceStatus.LATE
        })
      })
    );
  });

  it("takes the per-employee lock before checking for duplicates", async () => {
    const { service, prisma } = createService();

    await service.checkIn(employee, location);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.attendanceRecord.findFirst.mock.invocationCallOrder[0]
    );
  });

  it("rejects a duplicate check-in while the latest punch is a check-in", async () => {
    const { service, prisma } = createService();
    prisma.attendanceRecord.findFirst.mockResolvedValueOnce({
      recordType: AttendanceRecordType.CHECK_IN
    });

    await expect(service.checkIn(employee, location)).rejects.toMatchObject({
      message: "You already checked in and have not checked out.",
      errorCode: "ATTENDANCE_INVALID_ACTION"
    });
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate check-out as already checked out", async () => {
    const { service, prisma } = createService();
    prisma.attendanceRecord.findFirst.mockResolvedValueOnce({
      recordType: AttendanceRecordType.CHECK_OUT
    });

    await expect(service.checkOut(employee, location)).rejects.toMatchObject({
      message: "You already checked out.",
      errorCode: "ATTENDANCE_INVALID_ACTION"
    });
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it("still rejects a check-out with no check-in today", async () => {
    const { service } = createService();

    await expect(service.checkOut(employee, location)).rejects.toMatchObject({
      message: expect.stringContaining("You have not checked in today")
    });
  });

  describe("company radius", () => {
    // Hoàn Kiếm, Hà Nội — the point `location` sits on.
    const office = { companyLatitude: 21.02776, companyLongitude: 105.83416 };

    it("rejects a punch outside the radius with its own error code", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-14T02:00:00Z"));
      const { service, prisma } = createService({
        ...office,
        attendanceRadiusMeters: 150,
        requireAttendanceLocation: true
      });

      // ~37km away, in Bắc Ninh.
      await expect(
        service.checkIn(employee, { latitude: 21.212445, longitude: 106.137263 })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: "ATTENDANCE_OUTSIDE_RADIUS"
        })
      });
      expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    });

    it("accepts a punch inside the radius", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-14T02:00:00Z"));
      const { service, prisma } = createService({
        ...office,
        attendanceRadiusMeters: 150,
        requireAttendanceLocation: true
      });

      // ~30m north of the office.
      await service.checkIn(employee, {
        latitude: 21.02803,
        longitude: 105.83416
      });

      expect(prisma.attendanceRecord.create).toHaveBeenCalled();
    });

    it("does not enforce a radius it has no company point for", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-14T02:00:00Z"));
      const { service, prisma } = createService({
        companyLatitude: null,
        companyLongitude: null,
        requireAttendanceLocation: true
      });

      await service.checkIn(employee, {
        latitude: 21.212445,
        longitude: 106.137263
      });

      expect(prisma.attendanceRecord.create).toHaveBeenCalled();
    });
  });
});
