import { Injectable } from "@nestjs/common";
import { LeaveRequestStatus, Prisma } from "@prisma/client";
import { employeeSearchWhere } from "../common/prisma-where";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { pagination } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { TimesheetQueryDto } from "./dto/timesheet-query.dto";
import {
  computeTimesheet,
  EmployeeTimesheet,
  monthRange,
  TimesheetAttendanceRecord,
  TimesheetLeave
} from "./timesheet";

export const timesheetEmployeeSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  companyEmail: true,
  department: { select: { id: true, code: true, name: true } },
  position: { select: { id: true, code: true, name: true } }
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService
  ) {}

  async list(query: TimesheetQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = employeeSearchWhere(query.search, query.departmentId);
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: timesheetEmployeeSelect,
        orderBy: { employeeCode: "asc" },
        skip,
        take
      }),
      this.prisma.employee.count({ where })
    ]);
    const timesheets = await this.forEmployees(
      query.year,
      query.month,
      employees.map((employee) => employee.id)
    );

    return {
      items: employees.map((employee) => ({
        employee,
        timesheet: timesheets.get(employee.id) as EmployeeTimesheet
      })),
      meta: { total, page, limit }
    };
  }

  /** Monthly timesheets keyed by employee id, one entry per requested id. */
  async forEmployees(
    year: number,
    month: number,
    employeeIds: number[]
  ): Promise<Map<number, EmployeeTimesheet>> {
    const settings = await this.systemSettings.getSettings();
    const { start, end } = monthRange(year, month);
    const [records, leaves] = employeeIds.length
      ? await Promise.all([
          this.prisma.attendanceRecord.findMany({
            where: {
              employeeId: { in: employeeIds },
              workDate: { gte: start, lte: end }
            },
            select: {
              employeeId: true,
              workDate: true,
              recordType: true,
              recordedAt: true
            }
          }),
          this.prisma.leaveRequest.findMany({
            where: {
              employeeId: { in: employeeIds },
              status: LeaveRequestStatus.APPROVED,
              startDate: { lte: end },
              endDate: { gte: start }
            },
            select: {
              employeeId: true,
              startDate: true,
              endDate: true,
              leaveType: { select: { isPaid: true } }
            }
          })
        ])
      : [[], []];

    const recordsByEmployee = new Map<number, TimesheetAttendanceRecord[]>();
    for (const record of records) {
      const list = recordsByEmployee.get(record.employeeId) ?? [];
      list.push(record);
      recordsByEmployee.set(record.employeeId, list);
    }
    const leavesByEmployee = new Map<number, TimesheetLeave[]>();
    for (const leave of leaves) {
      const list = leavesByEmployee.get(leave.employeeId) ?? [];
      list.push({
        startDate: leave.startDate,
        endDate: leave.endDate,
        isPaid: leave.leaveType.isPaid
      });
      leavesByEmployee.set(leave.employeeId, list);
    }

    return new Map(
      employeeIds.map((employeeId) => [
        employeeId,
        computeTimesheet(
          year,
          month,
          recordsByEmployee.get(employeeId) ?? [],
          leavesByEmployee.get(employeeId) ?? [],
          settings
        )
      ])
    );
  }
}
