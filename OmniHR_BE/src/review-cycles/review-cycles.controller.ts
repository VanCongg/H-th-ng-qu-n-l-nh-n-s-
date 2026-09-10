import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { CreateReviewCycleDto } from "./dto/create-review-cycle.dto";
import { UpdateReviewCycleDto } from "./dto/update-review-cycle.dto";
import { ReviewCyclesService } from "./review-cycles.service";

@ApiTags("review-cycles")
@ApiBearerAuth()
@Controller("review-cycles")
export class ReviewCyclesController {
  constructor(private readonly reviewCyclesService: ReviewCyclesService) {}

  // Readable by anyone who can see reviews at all - the cycle list is a
  // lookup table the review screens filter by, not sensitive config.
  @Permissions("REVIEW_MANAGE", "REVIEW_READ_ALL", "REVIEW_READ_TEAM", "REVIEW_READ_SELF")
  @Get()
  findAll() {
    return this.reviewCyclesService.findAll();
  }

  @Permissions("REVIEW_MANAGE", "REVIEW_READ_ALL", "REVIEW_READ_TEAM", "REVIEW_READ_SELF")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.reviewCyclesService.findOne(id);
  }

  @Permissions("REVIEW_MANAGE")
  @Post()
  create(
    @Body() dto: CreateReviewCycleDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.reviewCyclesService.create(dto, user, context);
  }

  @Permissions("REVIEW_MANAGE")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReviewCycleDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.reviewCyclesService.update(id, dto, user, context);
  }

  @Permissions("REVIEW_MANAGE")
  @Post(":id/launch")
  launch(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.reviewCyclesService.launch(id, user, context);
  }
}
