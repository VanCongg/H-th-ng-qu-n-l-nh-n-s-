import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { pagination } from "../common/utils";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditLogQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where: Prisma.AuditLogWhereInput = {
      userId: query.userId,
      action: query.action
        ? { contains: query.action, mode: "insensitive" }
        : undefined,
      entityType: query.entityType,
      createdAt:
        query.fromDate || query.toDate
          ? {
              gte: query.fromDate ? new Date(query.fromDate) : undefined,
              lte: query.toDate ? new Date(query.toDate) : undefined
            }
          : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }
}
