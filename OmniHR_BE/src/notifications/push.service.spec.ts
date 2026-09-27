import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { pushText } from "./push-text";
import { PushService } from "./push.service";

describe("pushText", () => {
  it("writes a status change in Vietnamese", () => {
    expect(
      pushText("vi", {
        type: "TASK_STATUS_CHANGED",
        title: "Task status updated",
        message: '"Build login" was moved to IN_REVIEW by Nguyễn Văn A.'
      })
    ).toEqual({
      title: "Trạng thái công việc được cập nhật",
      body: 'Nguyễn Văn A đã chuyển công việc "Build login" sang "Đang review".'
    });
  });

  it("formats the dates in an approved leave", () => {
    expect(
      pushText("vi", {
        type: "LEAVE_APPROVED",
        title: "Leave request approved",
        message: "Your leave request from Mon Sep 21 2026 to 2026-09-22 was approved."
      }).body
    ).toBe("Đơn nghỉ phép từ 21/09/2026 đến 22/09/2026 của bạn đã được duyệt.");
  });

  it("keeps the stored English for an English device or an unknown sentence", () => {
    const notification = { type: "TASK_ASSIGNED", title: "New task assigned", message: "Custom text" };
    expect(pushText("en", notification)).toEqual({ title: "New task assigned", body: "Custom text" });
    expect(pushText("vi", notification)).toEqual({
      title: "Bạn được giao công việc mới",
      body: "Custom text"
    });
  });
});

describe("PushService", () => {
  function createService(serviceAccount = "") {
    const prisma = {
      pushDevice: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn()
      }
    };
    const config = { get: jest.fn(() => serviceAccount) };
    return {
      service: new PushService(prisma as unknown as PrismaService, config as unknown as ConfigService),
      prisma
    };
  }

  it("sends nothing and touches no devices when Firebase is not configured", async () => {
    const { service, prisma } = createService();

    await service.send({ id: 1, userId: 7, type: "TASK_ASSIGNED", title: "t", message: "m" } as never);

    expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
  });

  it("treats an unreadable service account as not configured", async () => {
    const { service, prisma } = createService("not-a-key");

    await service.send({ id: 1, userId: 7, type: "TASK_ASSIGNED", title: "t", message: "m" } as never);

    expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
  });

  it("moves a token to whoever registered it last", async () => {
    const { service, prisma } = createService();

    await service.registerDevice(9, "token-1", "android", "en");

    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "token-1" },
        update: { userId: 9, platform: "android", language: "en" }
      })
    );
  });
});
