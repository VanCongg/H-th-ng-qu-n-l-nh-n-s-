import { HttpStatus, Injectable } from "@nestjs/common";
import { EmployeeStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { toDateOnly } from "../common/utils";
import { CreateReviewCycleDto } from "./dto/create-review-cycle.dto";
import { UpdateReviewCycleDto } from "./dto/update-review-cycle.dto";

@Injectable()
export class ReviewCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll() {
    return this.prisma.reviewCycle.findMany({ orderBy: { startDate: "desc" } });
  }

  async findOne(id: number) {
    const cycle = await this.prisma.reviewCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Review cycle not found",
        "REVIEW_CYCLE_NOT_FOUND"
      );
    }
    return cycle;
  }

  async create(dto: CreateReviewCycleDto, actor: AuthUser, context?: RequestContext) {
    const cycle = await this.prisma.reviewCycle.create({
      data: {
        name: dto.name,
        startDate: toDateOnly(dto.startDate),
        endDate: toDateOnly(dto.endDate)
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_REVIEW_CYCLE",
      entityType: "ReviewCycle",
      entityId: cycle.id,
      newValue: cycle,
      context
    });

    return cycle;
  }

  async update(
    id: number,
    dto: UpdateReviewCycleDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const cycle = await this.prisma.reviewCycle.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
        endDate: dto.endDate ? toDateOnly(dto.endDate) : undefined,
        status: dto.status
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_REVIEW_CYCLE",
      entityType: "ReviewCycle",
      entityId: id,
      oldValue,
      newValue: cycle,
      context
    });

    return cycle;
  }

  async launch(id: number, actor: AuthUser, context?: RequestContext) {
    const cycle = await this.findOne(id);
    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
      select: { id: true }
    });

    const result = await this.prisma.performanceReview.createMany({
      data: employees.map((employee) => ({
        cycleId: cycle.id,
        employeeId: employee.id
      })),
      skipDuplicates: true
    });

    await this.audit.log({
      userId: actor.id,
      action: "LAUNCH_REVIEW_CYCLE",
      entityType: "ReviewCycle",
      entityId: id,
      newValue: { createdCount: result.count },
      context
    });

    return { createdCount: result.count };
  }
}
