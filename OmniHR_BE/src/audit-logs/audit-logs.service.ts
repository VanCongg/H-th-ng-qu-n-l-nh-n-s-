import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AUDIT_CATEGORIES, ROUTINE_AUDIT_ACTIONS, SECURITY_AUDIT_ACTIONS } from "../common/audit-actions";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { pagination } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

const DAY_MS = 24 * 60 * 60 * 1000;
/** First clean-up a minute after start, then once a day. */
const FIRST_RUN_DELAY_MS = 60 * 1000;

@Injectable()
export class AuditLogsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if ((this.config.get<string>("AUDIT_RETENTION_JOB") ?? "true") === "false") {
      return;
    }
    // unref: a pending clean-up never keeps the process alive on shutdown.
    const run = () => void this.purgeExpired().catch((error) => this.logger.warn(`Audit clean-up failed: ${error}`));
    this.timers.push(setTimeout(run, FIRST_RUN_DELAY_MS).unref(), setInterval(run, DAY_MS).unref());
  }

  onModuleDestroy() {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  async findAll(query: AuditLogQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const actionFilters: Prisma.StringFilter[] = [];
    if (query.action) {
      actionFilters.push({ contains: query.action, mode: "insensitive" });
    }
    if (query.category) {
      actionFilters.push({ in: [...AUDIT_CATEGORIES[query.category]] });
    }
    if (query.importantOnly) {
      actionFilters.push({ notIn: [...ROUTINE_AUDIT_ACTIONS] });
    }
    const where: Prisma.AuditLogWhereInput = {
      userId: query.userId,
      AND: actionFilters.map((action) => ({ action })),
      entityType: query.entityType,
      createdAt:
        query.fromDate || query.toDate
          ? {
              gte: query.fromDate ? new Date(query.fromDate) : undefined,
              lte: query.toDate ? endOfDay(query.toDate) : undefined
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

  /**
   * Deletes rows past their retention: security actions (sign-ins, roles,
   * permissions, passwords, settings) after `auditSecurityRetentionDays`,
   * everything else after `auditRetentionDays`. 0 keeps them forever.
   */
  async purgeExpired(now = new Date()) {
    const settings = await this.systemSettings.getSettings();
    const security = [...SECURITY_AUDIT_ACTIONS];
    const cutoff = (days: number) => new Date(now.getTime() - days * DAY_MS);
    let deleted = 0;
    if (settings.auditRetentionDays > 0) {
      deleted += (
        await this.prisma.auditLog.deleteMany({
          where: { action: { notIn: security }, createdAt: { lt: cutoff(settings.auditRetentionDays) } }
        })
      ).count;
    }
    if (settings.auditSecurityRetentionDays > 0) {
      deleted += (
        await this.prisma.auditLog.deleteMany({
          where: { action: { in: security }, createdAt: { lt: cutoff(settings.auditSecurityRetentionDays) } }
        })
      ).count;
    }
    if (deleted) {
      this.logger.log(`Removed ${deleted} audit rows past their retention`);
    }
    return deleted;
  }
}

/** A date filter's last day counts in full, not only its first instant. */
function endOfDay(value: string) {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(date.getTime() + DAY_MS - 1) : date;
}
