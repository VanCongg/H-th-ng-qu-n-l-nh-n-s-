import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestContext } from "../types";

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

  async log(payload: AuditPayload) {
    await this.prisma.auditLog.create({
      data: {
        userId: payload.userId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId:
          payload.entityId === undefined || payload.entityId === null
            ? null
            : String(payload.entityId),
        oldValue: this.toJson(payload.oldValue),
        newValue: this.toJson(payload.newValue),
        ipAddress: payload.context?.ip,
        userAgent: payload.context?.userAgent
      }
    });
  }

  private toJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }
}
