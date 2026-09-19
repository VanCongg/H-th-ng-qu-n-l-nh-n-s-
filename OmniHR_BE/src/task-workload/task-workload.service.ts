import { Injectable } from "@nestjs/common";
import { TaskStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { toDateOnly } from "../common/utils";
import {
  WORKLOAD_CAPACITY_HOURS_PER_WEEK,
  workloadScoreFor
} from "../ai-task-suggestions/suggestion-scoring";
import { TaskWorkloadQueryDto, TaskWorkloadScope } from "./dto/task-workload-query.dto";

export type WorkloadSummary = {
  employeeId: number;
  activeTaskCount: number;
  totalEstimatedHours: number;
  overdueTaskCount: number;
  capacityHoursPerWeek: number;
  availableHours: number;
  workloadScore: number;
};

const activeStatuses = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW
];

@Injectable()
export class TaskWorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService
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

  async summariesForEmployees(employeeIds: number[]) {
    const map = new Map<number, WorkloadSummary>();
    await Promise.all(
      employeeIds.map(async (employeeId) => {
        map.set(employeeId, await this.summaryForEmployee(employeeId));
      })
    );
    return map;
  }

  async summaryForEmployee(employeeId: number): Promise<WorkloadSummary> {
    const today = toDateOnly(new Date());
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        deletedAt: null,
        status: { in: activeStatuses }
      },
      select: { estimatedHours: true, dueDate: true }
    });

    const totalEstimatedHours = tasks.reduce(
      (total, task) => total + Number(task.estimatedHours ?? 4),
      0
    );
    const overdueTaskCount = tasks.filter(
      (task) => task.dueDate && task.dueDate < today
    ).length;
    const capacityHoursPerWeek = WORKLOAD_CAPACITY_HOURS_PER_WEEK;
    const availableHours = capacityHoursPerWeek - totalEstimatedHours;
    const workloadScore = workloadScoreFor(totalEstimatedHours, overdueTaskCount);

    return {
      employeeId,
      activeTaskCount: tasks.length,
      totalEstimatedHours,
      overdueTaskCount,
      capacityHoursPerWeek,
      availableHours,
      workloadScore
    };
  }

  private emptySummary(employeeId: number): WorkloadSummary {
    return {
      employeeId,
      activeTaskCount: 0,
      totalEstimatedHours: 0,
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
