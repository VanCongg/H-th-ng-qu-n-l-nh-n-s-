import { HttpStatus, Injectable } from "@nestjs/common";
import { PerformanceReviewStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination } from "../common/utils";
import { NotificationsService } from "../notifications/notifications.service";
import { FinalizeReviewDto } from "./dto/finalize-review.dto";
import { PerformanceReviewQueryDto } from "./dto/performance-review-query.dto";
import { SubmitManagerReviewDto } from "./dto/submit-manager-review.dto";
import { SubmitSelfReviewDto } from "./dto/submit-self-review.dto";

const reviewInclude = {
  employee: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      userId: true,
      department: { select: { id: true, name: true } }
    }
  },
  cycle: true,
  reviewer: {
    select: { id: true, username: true, email: true }
  }
} satisfies Prisma.PerformanceReviewInclude;

@Injectable()
export class PerformanceReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly notifications: NotificationsService
  ) {}

  async findAll(query: PerformanceReviewQueryDto) {
    return this.paginatedList(this.buildWhere(query), query);
  }

  async findSelf(user: AuthUser, query: PerformanceReviewQueryDto) {
    const employeeId = this.requireEmployee(user);
    return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
  }

  async findTeam(user: AuthUser, query: PerformanceReviewQueryDto) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    return this.paginatedList(
      { ...this.buildWhere(query), employeeId: { in: teamIds } },
      query
    );
  }

  async findOne(id: number, user: AuthUser) {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: reviewInclude
    });
    if (!review) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Performance review not found",
        "REVIEW_NOT_FOUND"
      );
    }

    await this.accessControl.ensureCanReadEmployee(user, review.employeeId);
    return review;
  }

  async submitSelf(
    id: number,
    dto: SubmitSelfReviewDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const review = await this.requireReview(id);
    if (user.employeeId !== review.employeeId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "You can only submit your own self-assessment",
        "REVIEW_ACCESS_DENIED"
      );
    }
    this.ensureStatus(review, PerformanceReviewStatus.PENDING_SELF);

    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        selfRating: dto.selfRating,
        selfComment: dto.selfComment,
        status: PerformanceReviewStatus.SELF_SUBMITTED,
        submittedAt: new Date()
      },
      include: reviewInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "SUBMIT_SELF_REVIEW",
      entityType: "PerformanceReview",
      entityId: id,
      oldValue: review,
      newValue: updated,
      context
    });

    return updated;
  }

  async submitManagerReview(
    id: number,
    dto: SubmitManagerReviewDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const review = await this.requireReview(id);
    await this.accessControl.ensureCanReviewEmployee(user, review.employeeId);
    this.ensureStatus(review, PerformanceReviewStatus.SELF_SUBMITTED);

    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        managerRating: dto.managerRating,
        managerComment: dto.managerComment,
        reviewerUserId: user.id,
        status: PerformanceReviewStatus.MANAGER_REVIEWED,
        reviewedAt: new Date()
      },
      include: reviewInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "SUBMIT_MANAGER_REVIEW",
      entityType: "PerformanceReview",
      entityId: id,
      oldValue: review,
      newValue: updated,
      context
    });

    return updated;
  }

  async finalize(
    id: number,
    dto: FinalizeReviewDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const review = await this.requireReview(id);
    this.ensureStatus(review, PerformanceReviewStatus.MANAGER_REVIEWED);

    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        finalRating: dto.finalRating ?? review.managerRating,
        status: PerformanceReviewStatus.FINALIZED,
        finalizedAt: new Date()
      },
      include: reviewInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "FINALIZE_REVIEW",
      entityType: "PerformanceReview",
      entityId: id,
      oldValue: review,
      newValue: updated,
      context
    });

    if (updated.employee.userId) {
      await this.notifications.create(
        updated.employee.userId,
        "REVIEW_FINALIZED",
        "Performance review finalized",
        `Your performance review for "${updated.cycle.name}" has been finalized.`,
        "PerformanceReview",
        updated.id
      );
    }

    return updated;
  }

  private async requireReview(id: number) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Performance review not found",
        "REVIEW_NOT_FOUND"
      );
    }
    return review;
  }

  private ensureStatus(
    review: { status: PerformanceReviewStatus },
    expected: PerformanceReviewStatus
  ) {
    if (review.status !== expected) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        `Performance review must be in ${expected} status`,
        "REVIEW_INVALID_STATUS"
      );
    }
  }

  private async paginatedList(
    where: Prisma.PerformanceReviewWhereInput,
    query: PerformanceReviewQueryDto
  ) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.performanceReview.findMany({
        where,
        include: reviewInclude,
        // Most recently acted-on first: a launched cycle creates hundreds of
        // untouched rows, so ordering by createdAt would bury the ones that
        // actually need a decision.
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take
      }),
      this.prisma.performanceReview.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private buildWhere(query: PerformanceReviewQueryDto): Prisma.PerformanceReviewWhereInput {
    return {
      cycleId: query.cycleId,
      status: query.status,
      employeeId: query.employeeId
    };
  }

  private requireEmployee(user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }
    return user.employeeId;
  }
}
