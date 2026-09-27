import { Injectable } from "@nestjs/common";
import { Prisma, TaskStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { companyToday } from "../leave-balances/leave-accrual";
import { AuthUser } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import {
  WORKLOAD_CAPACITY_HOURS_PER_WEEK,
  weeklyLoad,
  workloadScoreFor
} from "../ai-task-suggestions/suggestion-scoring";
import { TaskWorkloadQueryDto, TaskWorkloadScope } from "./dto/task-workload-query.dto";

export type WorkloadSummary = {
  employeeId: number;
  activeTaskCount: number;
  /** Work left on open tasks, whenever it is due. */
  totalEstimatedHours: number;
  /** The part of it landing in the coming week; capacity is measured against this. */
  weeklyLoadHours: number;
  overdueTaskCount: number;
  capacityHoursPerWeek: number;
  availableHours: number;
  workloadScore: number;
};

/** What the weekly-load rule reads from an open task. */
const openTaskSelect = {
  status: true,
  estimatedHours: true,
  actualHours: true,
  startDate: true,
  dueDate: true
} satisfies Prisma.TaskSelect;

type OpenTaskRow = Prisma.TaskGetPayload<{ select: typeof openTaskSelect }>;

const activeStatuses = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW
];

@Injectable()
export class TaskWorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService
  ) {}

  async findAll(user: AuthUser, query: TaskWorkloadQueryDto) {
    const allowedIds = await this.employeeScope(user, query.scope ?? "all");
    const employeeIds = query.employeeId
      ? await this.singleEmployeeScope(user, query.employeeId, allowedIds)
      : allowedIds;

    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({ id: { in: employeeIds } }),
      include: { department: true, position: true },
      orderBy: { fullName: "asc" }
    });
    const summaries = await this.summariesForEmployees(employees.map((item) => item.id));

    return employees.map((employee) => ({
      employee,
      workload: summaries.get(employee.id) ?? this.emptySummary(employee.id)
    }));
  }

  /**
   * One query for everyone rather than one per person: a department head's
   * workload page or a suggestion shortlist covers dozens of employees.
   */
  async summariesForEmployees(employeeIds: number[]) {
    const map = new Map<number, WorkloadSummary>();
    if (!employeeIds.length) {
      return map;
    }
    const [today, tasks] = await Promise.all([
      this.today(),
      this.prisma.task.findMany({
        where: {
          assigneeId: { in: employeeIds },
          deletedAt: null,
          status: { in: activeStatuses }
        },
        select: { assigneeId: true, ...openTaskSelect }
      })
    ]);
    const byEmployee = new Map<number, OpenTaskRow[]>();
    for (const { assigneeId, ...task } of tasks) {
      if (assigneeId !== null) {
        byEmployee.set(assigneeId, [...(byEmployee.get(assigneeId) ?? []), task]);
      }
    }
    for (const employeeId of employeeIds) {
      map.set(employeeId, this.summarize(employeeId, byEmployee.get(employeeId) ?? [], today));
    }
    return map;
  }

  async summaryForEmployee(employeeId: number, today?: Date): Promise<WorkloadSummary> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        deletedAt: null,
        status: { in: activeStatuses }
      },
      select: openTaskSelect
    });
    return this.summarize(employeeId, tasks, today ?? (await this.today()));
  }

  private summarize(employeeId: number, tasks: OpenTaskRow[], today: Date): WorkloadSummary {
    const load = weeklyLoad(
      tasks.map((task) => ({
        status: task.status,
        estimatedHours: task.estimatedHours === null ? null : Number(task.estimatedHours),
        actualHours: task.actualHours === null ? null : Number(task.actualHours),
        startDate: task.startDate,
        dueDate: task.dueDate
      })),
      today
    );
    const capacityHoursPerWeek = WORKLOAD_CAPACITY_HOURS_PER_WEEK;

    return {
      employeeId,
      activeTaskCount: tasks.length,
      totalEstimatedHours: load.remainingHours,
      weeklyLoadHours: load.weeklyHours,
      overdueTaskCount: load.overdueCount,
      capacityHoursPerWeek,
      availableHours: Math.round((capacityHoursPerWeek - load.weeklyHours) * 10) / 10,
      workloadScore: workloadScoreFor(load.weeklyHours, load.overdueCount)
    };
  }

  /** Today in the company's timezone: "overdue" flips at local midnight, not UTC. */
  private async today() {
    const settings = await this.systemSettings.getSettings();
    return companyToday(settings.timezoneOffsetMinutes);
  }

  private emptySummary(employeeId: number): WorkloadSummary {
    return {
      employeeId,
      activeTaskCount: 0,
      totalEstimatedHours: 0,
      weeklyLoadHours: 0,
      overdueTaskCount: 0,
      capacityHoursPerWeek: 40,
      availableHours: 40,
      workloadScore: 100
    };
  }

  private async singleEmployeeScope(
    user: AuthUser,
    employeeId: number,
    allowedIds: number[]
  ) {
    await this.accessControl.ensureCanReadEmployee(user, employeeId);
    return allowedIds.includes(employeeId) ? [employeeId] : [];
  }

  private async employeeScope(user: AuthUser, scope: TaskWorkloadScope) {
    if (scope === "self") {
      return user.employeeId ? [user.employeeId] : [];
    }

    if (scope === "team") {
      return this.accessControl.teamEmployeeIds(user);
    }

    return this.defaultEmployeeScope(user);
  }

  private async defaultEmployeeScope(user: AuthUser) {
    if (this.accessControl.isAdmin(user)) {
      return this.accessControl.candidateEmployeeIdsForTask(user);
    }

    if (this.accessControl.isManager(user)) {
      return this.accessControl.teamEmployeeIds(user);
    }

    return user.employeeId ? [user.employeeId] : [];
  }
}
