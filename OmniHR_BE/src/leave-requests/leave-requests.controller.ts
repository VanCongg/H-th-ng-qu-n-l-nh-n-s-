import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { LeaveRequestQueryDto } from "./dto/leave-request-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@ApiTags("leave-requests")
@ApiBearerAuth()
@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Permissions("LEAVE_CREATE")
  @Post()
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.create(dto, user, context);
  }

  @Permissions("LEAVE_READ_ALL")
  @Get()
  findAll(@Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findAll(query);
  }

  @Permissions("LEAVE_READ_SELF")
  @Get("self")
  findSelf(@CurrentUser() user: AuthUser, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findSelf(user, query);
  }

  @Permissions("LEAVE_READ_TEAM")
  @Get("team")
  findTeam(@CurrentUser() user: AuthUser, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findTeam(user, query);
  }

  @Permissions("LEAVE_READ_ALL", "LEAVE_READ_TEAM", "LEAVE_READ_SELF")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.leaveRequestsService.findOne(id, user);
  }

  @Permissions("LEAVE_APPROVE")
  @Post(":id/approve")
  approve(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.approve(id, user, context);
  }

  @Permissions("LEAVE_REJECT")
  @Post(":id/reject")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.reject(id, dto, user, context);
  }

  @Permissions("LEAVE_CANCEL_SELF")
  @Post(":id/cancel")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.cancel(id, user, context);
  }
}
