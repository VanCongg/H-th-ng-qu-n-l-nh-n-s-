import { HttpStatus, Injectable } from "@nestjs/common";
import { Holiday, Prisma } from "@prisma/client";
import { ApiError } from "../api-error";
import { AuthUser, RequestContext } from "../types";
import { toDateOnly } from "../utils";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "./audit.service";

/**
 * Public holidays and compensatory days off. Every count of working days -
 * leave length, the monthly standard, the days a task can be worked on -
 * leaves them out, so Tết costs no annual leave and nobody is absent on 2/9.
 * Global like the system settings, because nearly every domain counts days.
 */
@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Holidays between two dates, both inclusive, as UTC-midnight timestamps. */
  async dateSet(from: Date, to: Date): Promise<Set<number>> {
    if (from > to) {
      return new Set();
    }
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      select: { date: true }
    });
    return new Set(rows.map((row) => row.date.getTime()));
  }

  /** Holidays of one year, or of the years around today when none is given. */
  list(year?: number) {
    const where: Prisma.HolidayWhereInput = year
      ? {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lte: new Date(Date.UTC(year, 11, 31))
          }
        }
      : {};
    return this.prisma.holiday.findMany({ where, orderBy: { date: "asc" } });
  }

  async create(
    dto: { date: string; name: string },
    actor: AuthUser,
    context?: RequestContext
  ) {
    const date = toDateOnly(dto.date);
    await this.ensureDateFree(date);
    const holiday = await this.prisma.holiday.create({
      data: { date, name: dto.name.trim() }
    });
    await this.audit.log({
      userId: actor.id,
      action: "CREATE_HOLIDAY",
      entityType: "Holiday",
      entityId: holiday.id,
      newValue: holiday,
      context
    });
    return holiday;
  }

  async update(
    id: number,
    dto: { date?: string; name?: string },
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const date = dto.date ? toDateOnly(dto.date) : undefined;
    if (date && date.getTime() !== oldValue.date.getTime()) {
      await this.ensureDateFree(date);
    }
    const holiday = await this.prisma.holiday.update({
      where: { id },
      data: { date, name: dto.name?.trim() }
    });
    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_HOLIDAY",
      entityType: "Holiday",
      entityId: id,
      oldValue,
      newValue: holiday,
      context
    });
    return holiday;
  }

  async remove(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: "DELETE_HOLIDAY",
      entityType: "Holiday",
      entityId: id,
      oldValue,
      context
    });
    return oldValue;
  }

  private async findOne(id: number): Promise<Holiday> {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Holiday not found", "HOLIDAY_NOT_FOUND");
    }
    return holiday;
  }

  private async ensureDateFree(date: Date) {
    const taken = await this.prisma.holiday.findUnique({ where: { date } });
    if (taken) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "That date is already a holiday",
        "HOLIDAY_DATE_TAKEN"
      );
    }
  }
}
