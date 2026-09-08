import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { FinalizeReviewDto } from "./dto/finalize-review.dto";
import { PerformanceReviewQueryDto } from "./dto/performance-review-query.dto";
import { SubmitManagerReviewDto } from "./dto/submit-manager-review.dto";
import { SubmitSelfReviewDto } from "./dto/submit-self-review.dto";
import { PerformanceReviewsService } from "./performance-reviews.service";

@ApiTags("performance-reviews")
@ApiBearerAuth()
@Controller("performance-reviews")
export class PerformanceReviewsController {
  constructor(private readonly performanceReviewsService: PerformanceReviewsService) {}

  @Permissions("REVIEW_READ_ALL")
  @Get()
  findAll(@Query() query: PerformanceReviewQueryDto) {
    return this.performanceReviewsService.findAll(query);
  }

  @Permissions("REVIEW_READ_SELF")
  @Get("self")
  findSelf(@CurrentUser() user: AuthUser, @Query() query: PerformanceReviewQueryDto) {
    return this.performanceReviewsService.findSelf(user, query);
  }

  @Permissions("REVIEW_READ_TEAM")
  @Get("team")
  findTeam(@CurrentUser() user: AuthUser, @Query() query: PerformanceReviewQueryDto) {
    return this.performanceReviewsService.findTeam(user, query);
  }

  @Permissions("REVIEW_READ_ALL", "REVIEW_READ_SELF", "REVIEW_READ_TEAM")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.performanceReviewsService.findOne(id, user);
  }

  @Permissions("REVIEW_SUBMIT_SELF")
  @Patch(":id/submit-self")
  submitSelf(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubmitSelfReviewDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.performanceReviewsService.submitSelf(id, dto, user, context);
  }

  @Permissions("REVIEW_SUBMIT_MANAGER")
  @Patch(":id/submit-manager")
  submitManager(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SubmitManagerReviewDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.performanceReviewsService.submitManagerReview(id, dto, user, context);
  }

  @Permissions("REVIEW_MANAGE")
  @Patch(":id/finalize")
  finalize(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: FinalizeReviewDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.performanceReviewsService.finalize(id, dto, user, context);
  }
}
