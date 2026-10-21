// API số dư phép năm: danh sách cho HR và số dư của chính mình.

import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { AuthUser } from "../common/types";
import {
  LeaveBalanceQueryDto,
  LeaveBalanceYearQueryDto
} from "./dto/leave-balance-query.dto";
import { LeaveBalancesService } from "./leave-balances.service";

@ApiTags("leave-balances")
@ApiBearerAuth()
@Controller("leave-balances")
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  // Số dư phép của mọi nhân viên (lọc, sắp xếp, phân trang).
  @Permissions("LEAVE_READ_ALL")
  @Get()
  list(@Query() query: LeaveBalanceQueryDto) {
    return this.leaveBalancesService.list(query);
  }

  // Số dư phép của người đang đăng nhập.
  @Permissions("LEAVE_READ_SELF")
  @Get("self")
  self(@CurrentUser() user: AuthUser, @Query() query: LeaveBalanceYearQueryDto) {
    return this.leaveBalancesService.forSelf(user, query.year);
  }
}
