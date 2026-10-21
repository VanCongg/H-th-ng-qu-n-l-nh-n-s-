import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardService } from "./dashboard.service";

describe("DashboardService.updateSettings", () => {
  const actor = {
    id: 7,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["SYSTEM_SETTING_UPDATE"],
    employeeId: 1,
    mustChangePassword: false
  };

  const before = {
    companyAddress: "72 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
    companyLatitude: null,
    companyLongitude: null,
    attendanceRadiusMeters: 150,
    workWeek: ["MONDAY", "TUESDAY"]
  };

  function createService(after: Record<string, unknown>) {
    const audit = { log: jest.fn() };
    const systemSettings = {
      getSettings: jest.fn().mockResolvedValue(before),
      updateSettings: jest.fn().mockResolvedValue(after)
    };

    return {
      audit,
      systemSettings,
      service: new DashboardService(
        {} as unknown as PrismaService,
        {} as unknown as AccessControlService,
        systemSettings as unknown as SystemSettingsService,
        audit as unknown as AuditService
      )
    };
  }

  it("records only the settings that actually moved", async () => {
    const { service, audit } = createService({
      ...before,
      companyLatitude: 21.212445,
      companyLongitude: 106.137263
    });

    await service.updateSettings(
      { companyLatitude: 21.212445, companyLongitude: 106.137263 },
      actor,
      { ip: "10.0.0.9", userAgent: "jest" }
    );

    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith({
      userId: 7,
      action: "UPDATE_SYSTEM_SETTINGS",
      entityType: "SystemSetting",
      entityId: "default",
      oldValue: { companyLatitude: null, companyLongitude: null },
      newValue: { companyLatitude: 21.212445, companyLongitude: 106.137263 },
      context: { ip: "10.0.0.9", userAgent: "jest" }
    });
  });

  it("compares arrays by value, not by reference", async () => {
    const { service, audit } = createService({
      ...before,
      workWeek: [...before.workWeek]
    });

    await service.updateSettings({ workWeek: ["MONDAY", "TUESDAY"] }, actor);

    expect(audit.log).not.toHaveBeenCalled();
  });

  it("stays quiet when a save changes nothing", async () => {
    const { service, audit, systemSettings } = createService({ ...before });

    await service.updateSettings({}, actor);

    expect(systemSettings.updateSettings).toHaveBeenCalledTimes(1);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
