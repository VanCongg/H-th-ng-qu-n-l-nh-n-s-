// Ghi audit log: ai làm gì, lên bản ghi nào, giá trị trước / sau, IP, user-agent.
// Truyền nguyên bản ghi trước / sau, hàm sẽ tự thu gọn (audit-compaction.ts).

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestContext } from "../types";
import { compactAuditValues } from "./audit-compaction";

type AuditPayload = {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldValue?: unknown;
  newValue?: unknown;
  context?: RequestContext;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Ghi một dòng audit; old/new value được thu gọn trước khi lưu.
  async log(payload: AuditPayload) {
    const { oldValue, newValue } = compactAuditValues(payload.oldValue, payload.newValue);
    await this.prisma.auditLog.create({
      data: {
        userId: payload.userId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId:
          payload.entityId === undefined || payload.entityId === null
            ? null
            : String(payload.entityId),
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        ipAddress: payload.context?.ip,
        userAgent: payload.context?.userAgent
      }
    });
  }
}
