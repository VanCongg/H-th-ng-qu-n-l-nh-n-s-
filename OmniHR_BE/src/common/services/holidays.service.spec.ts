import { PrismaService } from "../../prisma/prisma.service";
import { AuthUser } from "../types";
import { AuditService } from "./audit.service";
import { HolidaysService } from "./holidays.service";

const admin: AuthUser = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  roles: ["ADMIN"],
  permissions: ["SYSTEM_SETTING_UPDATE"],
  employeeId: null,
  mustChangePassword: false
};

function createService() {
  const prisma = {
    holiday: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(({ data }) => Promise.resolve({ id: 5, ...data })),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
  const audit = { log: jest.fn() };
  return {
    service: new HolidaysService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService
    ),
    prisma,
    audit
  };
}

describe("HolidaysService", () => {
  it("returns the holidays of a range as UTC-midnight timestamps", async () => {
    const { service, prisma } = createService();
    prisma.holiday.findMany.mockResolvedValue([
      { date: new Date(Date.UTC(2026, 8, 1)) },
      { date: new Date(Date.UTC(2026, 8, 2)) }
    ]);

    const set = await service.dateSet(new Date("2026-08-31"), new Date("2026-09-04"));

    expect(set).toEqual(new Set([Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 2)]));
    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {
        date: { gte: new Date(Date.UTC(2026, 7, 31)), lte: new Date(Date.UTC(2026, 8, 4)) }
      },
      select: { date: true }
    });
  });

  it("does not query an empty range", async () => {
    const { service, prisma } = createService();

    await expect(
      service.dateSet(new Date("2026-09-04"), new Date("2026-09-01"))
    ).resolves.toEqual(new Set());
    expect(prisma.holiday.findMany).not.toHaveBeenCalled();
  });

  it("refuses a second holiday on the same date", async () => {
    const { service, prisma } = createService();
    prisma.holiday.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.create({ date: "2026-09-02", name: "Quốc khánh" }, admin)
    ).rejects.toMatchObject({ errorCode: "HOLIDAY_DATE_TAKEN" });
    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it("creates a holiday and records it in the audit log", async () => {
    const { service, prisma, audit } = createService();
    prisma.holiday.findUnique.mockResolvedValue(null);

    await service.create({ date: "2027-02-06", name: "  Tết Nguyên đán  " }, admin);

    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: { date: new Date(Date.UTC(2027, 1, 6)), name: "Tết Nguyên đán" }
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_HOLIDAY", entityType: "Holiday" })
    );
  });
});
