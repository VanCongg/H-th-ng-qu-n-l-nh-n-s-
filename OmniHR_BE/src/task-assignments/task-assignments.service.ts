import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
import { pagination } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { TaskAssignmentQueryDto } from "./dto/task-assignment-query.dto";

const assignmentInclude = {
  task: {
    include: {
      project: true,
      assignee: { include: { department: true, position: true } }
    }
  },
  assignee: { include: { department: true, position: true } },
  assignedByUser: { select: { id: true, username: true, email: true } }
} satisfies Prisma.TaskAssignmentInclude;

@Injectable()
export class TaskAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService
  ) {}

  async findAll(query: TaskAssignmentQueryDto, user: AuthUser) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = await this.buildWhere(query, user);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.taskAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { assignedAt: "desc" },
        skip,
        take
      }),
      this.prisma.taskAssignment.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private async buildWhere(query: TaskAssignmentQueryDto, user: AuthUser) {
    const base: Prisma.TaskAssignmentWhereInput = {
      taskId: query.taskId,
      assigneeId: query.assigneeId,
      assignmentType: query.assignmentType,
      task: { deletedAt: null }
    };

    if (this.accessControl.isAdmin(user)) {
      return base;
    }

    if (this.accessControl.isManager(user)) {
      const teamIds = await this.accessControl.teamEmployeeIds(user);
      return {
        AND: [
          base,
          {
            OR: [
              { assigneeId: { in: teamIds } },
              { task: { createdByUserId: user.id } }
            ]
          }
        ]
      };
    }

    return {
      AND: [base, { assigneeId: user.employeeId ?? -1 }]
    };
  }
}
