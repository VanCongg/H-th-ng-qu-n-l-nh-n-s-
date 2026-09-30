import { ConfigService } from "@nestjs/config";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "./mail.service";
import { maskEmail, VerificationService } from "./verification.service";

describe("VerificationService", () => {
  const user = {
    id: 5,
    username: "congnv",
    email: "nvcong1908@gmail.com",
    roles: ["EMPLOYEE"],
    permissions: [],
    employeeId: 81,
    mustChangePassword: false
  };

  function createService() {
    const store: Array<Record<string, unknown>> = [];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: "nvcong1908@gmail.com",
          employee: { fullName: "Công Nguyễn Văn", phone: "0901000001" }
        }),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
      verificationCode: {
        findFirst: jest.fn(async () => store[store.length - 1] ?? null),
        updateMany: jest.fn(),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: store.length + 1, attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
          store.push(row);
          return row;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = store[store.length - 1];
          if (data.attempts) {
            row.attempts = (row.attempts as number) + 1;
          }
          if (data.consumedAt) {
            row.consumedAt = data.consumedAt;
          }
          return row;
        }),
        delete: jest.fn()
      }
    };
    const mail = { send: jest.fn() };
    const config = { get: jest.fn((key: string) => (key === "JWT_ACCESS_SECRET" ? "secret" : undefined)) };
    const service = new VerificationService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      { log: jest.fn() } as unknown as AuditService,
      config as unknown as ConfigService
    );
    return { service, prisma, mail, store };
  }

  /** The code the service emailed, read back from the message it sent. */
  function sentCode(mail: { send: jest.Mock }) {
    return /: (\d{6})$/.exec(mail.send.mock.calls[0][0].subject)![1];
  }

  it("emails a six-digit code to the account's own address for a password change", async () => {
    const { service, mail } = createService();

    const result = await service.requestCode(user, "PASSWORD_CHANGE", null);

    expect(mail.send.mock.calls[0][0].to).toBe("nvcong1908@gmail.com");
    expect(sentCode(mail)).toMatch(/^\d{6}$/);
    expect(result.sentTo).toBe("nv***@gmail.com");
  });

  it("sends the code for a new email to that new address", async () => {
    const { service, mail } = createService();

    await service.requestCode(user, "EMAIL_CHANGE", "New.Mail@Gmail.com");

    expect(mail.send.mock.calls[0][0].to).toBe("new.mail@gmail.com");
  });

  it("refuses an email someone else already uses", async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue({ id: 9 });

    await expect(service.requestCode(user, "EMAIL_CHANGE", "minhnh@gmail.com")).rejects.toMatchObject({
      errorCode: "EMAIL_ALREADY_IN_USE"
    });
  });

  it("makes a second request wait a minute", async () => {
    const { service } = createService();
    await service.requestCode(user, "PASSWORD_CHANGE", null);

    await expect(service.requestCode(user, "PASSWORD_CHANGE", null)).rejects.toMatchObject({
      errorCode: "VERIFICATION_RESEND_TOO_SOON"
    });
  });

  it("accepts the right code once, for the value it was sent for", async () => {
    const { service, mail } = createService();
    await service.requestCode(user, "PHONE_CHANGE", " 0987654321 ");
    const code = sentCode(mail);

    await expect(service.consume(5, "PHONE_CHANGE", code, "0999999999")).rejects.toMatchObject({
      errorCode: "VERIFICATION_TARGET_MISMATCH"
    });
    await expect(service.consume(5, "PHONE_CHANGE", code, "0987654321")).resolves.toBeUndefined();
  });

  it("stops accepting a code after five wrong tries", async () => {
    const { service, mail } = createService();
    await service.requestCode(user, "PASSWORD_CHANGE", null);
    const code = sentCode(mail);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.consume(5, "PASSWORD_CHANGE", wrong)).rejects.toMatchObject({
        errorCode: "VERIFICATION_CODE_INVALID"
      });
    }
    await expect(service.consume(5, "PASSWORD_CHANGE", code)).rejects.toMatchObject({
      errorCode: "VERIFICATION_CODE_LOCKED"
    });
  });

  it("asks for a code when none is given", async () => {
    const { service } = createService();

    await expect(service.consume(5, "PASSWORD_CHANGE", undefined)).rejects.toMatchObject({
      errorCode: "VERIFICATION_CODE_REQUIRED"
    });
  });

  it("masks an address enough to recognise it", () => {
    expect(maskEmail("vancongng1908@gmail.com")).toBe("va***@gmail.com");
  });
});
