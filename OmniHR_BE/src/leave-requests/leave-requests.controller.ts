// API đơn nghỉ phép: nhân viên tạo / xem / hủy đơn của mình; quản lý xem đơn của team,
// duyệt / từ chối đơn và duyệt / từ chối yêu cầu hủy đơn đã duyệt.

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
import { CancelLeaveRequestDto } from "./dto/cancel-leave-request.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@ApiTags("leave-requests")
@ApiBearerAuth()
@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // Nhân viên tạo đơn nghỉ.
  @Permissions("LEAVE_CREATE")
  @Post()
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.create(dto, user, context);
  }

  // Toàn bộ đơn nghỉ (HR / admin).
  @Permissions("LEAVE_READ_ALL")
  @Get()
  findAll(@Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findAll(query);
  }

  // Đơn nghỉ của chính mình.
  @Permissions("LEAVE_READ_SELF")
  @Get("self")
  findSelf(@CurrentUser() user: AuthUser, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findSelf(user, query);
  }

  // Đơn nghỉ của cấp dưới.
  @Permissions("LEAVE_READ_TEAM")
  @Get("team")
  findTeam(@CurrentUser() user: AuthUser, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findTeam(user, query);
  }

  // Chi tiết một đơn (kiểm tra quyền xem).
  @Permissions("LEAVE_READ_ALL", "LEAVE_READ_TEAM", "LEAVE_READ_SELF")
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.leaveRequestsService.findOne(id, user);
  }

  // Quản lý duyệt đơn.
  @Permissions("LEAVE_APPROVE")
  @Post(":id/approve")
  approve(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.approve(id, user, context);
  }

  // Quản lý từ chối đơn.
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

  /** Withdraws a pending request, or asks a manager to withdraw an approved one. */
  @Permissions("LEAVE_CANCEL_SELF")
  @Post(":id/cancel")
  cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CancelLeaveRequestDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.cancel(id, user, context, dto.reason);
  }

  // Quản lý đồng ý yêu cầu hủy đơn đã duyệt -> đơn bị hủy, trả lại ngày phép.
  @Permissions("LEAVE_APPROVE")
  @Post(":id/cancel-request/approve")
  approveCancellation(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.approveCancellation(id, user, context);
  }

  // Quản lý từ chối yêu cầu hủy -> đơn vẫn giữ nguyên.
  @Permissions("LEAVE_REJECT")
  @Post(":id/cancel-request/reject")
  rejectCancellation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.leaveRequestsService.rejectCancellation(id, dto, user, context);
  }
}
