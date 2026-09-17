import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { EmployeeStatus, PayrollPeriodStatus, Prisma } from "@prisma/client";
import { timesheetEmployeeSelect, TimesheetService } from "../attendance/timesheet.service";
import { ApiError } from "../common/api-error";
import { currentEmployeeWhere, employeeSearchWhere } from "../common/prisma-where";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination } from "../common/utils";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CompensationQueryDto,
  CreatePayrollPeriodDto,
  SendPayslipsDto,
  UpsertCompensationDto
} from "./dto/payroll.dto";
import { calculatePayslip } from "./payroll-calculator";
import { buildPayslipEmail } from "./payslip-email";

const payslipInclude = {
  employee: { select: timesheetEmployeeSelect }
} satisfies Prisma.PayslipInclude;

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly systemSettings: SystemSettingsService,
    private readonly timesheets: TimesheetService,
    private readonly mail: MailService
  ) {}

  async listCompensations(query: CompensationQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = employeeSearchWhere(query.search, query.departmentId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: { ...timesheetEmployeeSelect, compensation: true },
        orderBy: { employeeCode: "asc" },
        skip,
        take
      }),
      this.prisma.employee.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  async upsertCompensation(
    employeeId: number,
    dto: UpsertCompensationDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id: employeeId }),
      select: { id: true, compensation: true }
    });
    if (!employee) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const data = {
      baseSalary: dto.baseSalary,
      allowance: dto.allowance ?? 0,
      insuranceSalary: dto.insuranceSalary ?? null,
      updatedByUserId: actor.id
    };
    const compensation = await this.prisma.employeeCompensation.upsert({
      where: { employeeId },
      create: { employeeId, ...data },
      update: data
    });

    await this.audit.log({
      userId: actor.id,
      action: "PAYROLL_COMPENSATION_UPDATE",
      entityType: "EmployeeCompensation",
      entityId: compensation.id,
      oldValue: employee.compensation,
      newValue: compensation,
      context
    });

    return compensation;
  }

  listPeriods() {
    return this.prisma.payrollPeriod.findMany({
      include: { _count: { select: { payslips: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }]
    });
  }

  async getPeriod(id: number) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payslips: {
          include: payslipInclude,
          orderBy: { employee: { employeeCode: "asc" } }
        }
      }
    });
    if (!period) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Payroll period not found",
        "PAYROLL_PERIOD_NOT_FOUND"
      );
    }
    return period;
  }

  async createPeriod(
    dto: CreatePayrollPeriodDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { year_month: { year: dto.year, month: dto.month } },
      select: { id: true }
    });
    if (existing) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        "A payroll period already exists for this month",
        "PAYROLL_PERIOD_EXISTS"
      );
    }

    const period = await this.prisma.payrollPeriod.create({
      data: { year: dto.year, month: dto.month, createdByUserId: actor.id }
    });
    await this.audit.log({
      userId: actor.id,
      action: "PAYROLL_PERIOD_CREATE",
      entityType: "PayrollPeriod",
      entityId: period.id,
      newValue: period,
      context
    });

    return this.calculate(period.id, actor, context);
  }

  /**
   * (Re)computes every payslip of a draft period from current salaries and
   * attendance. Active employees without a salary on file are left out.
   */
  async calculate(id: number, actor: AuthUser, context?: RequestContext) {
    const period = await this.requireDraft(id);
    const settings = await this.systemSettings.getSettings();
    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({
        status: EmployeeStatus.ACTIVE,
        compensation: { isNot: null }
      }),
      select: { id: true, compensation: true }
    });
    const timesheets = await this.timesheets.forEmployees(
      period.year,
      period.month,
      employees.map((employee) => employee.id)
    );

    const rows = employees.flatMap((employee) => {
      const timesheet = timesheets.get(employee.id);
      if (!employee.compensation || !timesheet) {
        return [];
      }
      const amounts = calculatePayslip(timesheet, employee.compensation, settings);
      return [
        {
          employeeId: employee.id,
          data: {
            ...amounts,
            standardWorkDays: timesheet.standardWorkDays,
            attendanceDays: timesheet.attendanceDays,
            paidLeaveDays: timesheet.paidLeaveDays,
            payableDays: timesheet.payableDays,
            lateMinutes: timesheet.lateMinutes,
            earlyLeaveMinutes: timesheet.earlyLeaveMinutes,
            overtimeMinutes: timesheet.overtimeMinutes,
            missingCheckOuts: timesheet.missingCheckOuts
          }
        }
      ];
    });

    await this.prisma.$transaction([
      this.prisma.payslip.deleteMany({
        where: {
          periodId: id,
          employeeId: { notIn: rows.map((row) => row.employeeId) }
        }
      }),
      ...rows.map((row) =>
        this.prisma.payslip.upsert({
          where: {
            periodId_employeeId: { periodId: id, employeeId: row.employeeId }
          },
          create: { periodId: id, employeeId: row.employeeId, ...row.data },
          update: { ...row.data, emailedAt: null, emailError: null }
        })
      ),
      this.prisma.payrollPeriod.update({
        where: { id },
        data: { calculatedAt: new Date() }
      })
    ]);

    await this.audit.log({
      userId: actor.id,
      action: "PAYROLL_CALCULATE",
      entityType: "PayrollPeriod",
      entityId: id,
      newValue: { payslipCount: rows.length },
      context
    });

    return this.getPeriod(id);
  }

  async finalize(id: number, actor: AuthUser, context?: RequestContext) {
    await this.requireDraft(id);
    const payslipCount = await this.prisma.payslip.count({ where: { periodId: id } });
    if (!payslipCount) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Calculate the payroll before finalizing it",
        "PAYROLL_PERIOD_EMPTY"
      );
    }

    const period = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: PayrollPeriodStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedByUserId: actor.id
      }
    });
    await this.audit.log({
      userId: actor.id,
      action: "PAYROLL_FINALIZE",
      entityType: "PayrollPeriod",
      entityId: id,
      newValue: period,
      context
    });

    return this.getPeriod(id);
  }

  async removePeriod(id: number, actor: AuthUser, context?: RequestContext) {
    const period = await this.requireDraft(id);
    await this.prisma.payrollPeriod.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: "PAYROLL_PERIOD_DELETE",
      entityType: "PayrollPeriod",
      entityId: id,
      oldValue: period,
      context
    });
    return { id };
  }

  /**
   * Emails each employee their own payslip. Delivery is per payslip, so one bad
   * address is recorded on that payslip without stopping the rest.
   */
  async sendPayslips(
    id: number,
    dto: SendPayslipsDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const period = await this.getPeriod(id);
    if (period.status !== PayrollPeriodStatus.FINALIZED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only a finalized payroll can be emailed",
        "PAYROLL_PERIOD_NOT_FINALIZED"
      );
    }
    this.mail.ensureConfigured();

    const targets = period.payslips.filter(
      (payslip) =>
        (!dto.employeeIds?.length || dto.employeeIds.includes(payslip.employeeId)) &&
        (!dto.onlyUnsent || !payslip.emailedAt)
    );
    const failures: Array<{ employeeId: number; error: string }> = [];
    let sent = 0;

    for (const payslip of targets) {
      try {
        await this.mail.send({
          to: payslip.employee.companyEmail,
          ...buildPayslipEmail(period, payslip)
        });
        await this.prisma.payslip.update({
          where: { id: payslip.id },
          data: { emailedAt: new Date(), emailError: null }
        });
        sent += 1;
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(
          0,
          500
        );
        this.logger.warn(
          `Payslip email failed periodId=${id} employeeId=${payslip.employeeId}: ${message}`
        );
        await this.prisma.payslip.update({
          where: { id: payslip.id },
          data: { emailError: message }
        });
        failures.push({ employeeId: payslip.employeeId, error: message });
      }
    }

    await this.audit.log({
      userId: actor.id,
      action: "PAYSLIP_EMAIL_SEND",
      entityType: "PayrollPeriod",
      entityId: id,
      newValue: { sent, failed: failures.length },
      context
    });

    return { sent, failed: failures.length, failures };
  }

  private async requireDraft(id: number) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Payroll period not found",
        "PAYROLL_PERIOD_NOT_FOUND"
      );
    }
    if (period.status !== PayrollPeriodStatus.DRAFT) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "This payroll period is finalized and can no longer change",
        "PAYROLL_PERIOD_FINALIZED"
      );
    }
    return period;
  }
}
