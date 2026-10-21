// API dashboard (admin và quản lý) và cấu hình hệ thống.

import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { DashboardService } from "./dashboard.service";
import { UpdateSystemSettingsDto } from "./dto/update-system-settings.dto";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Số liệu tổng quan cho admin.
  @Roles("ADMIN")
  @Get("admin/dashboard")
  adminDashboard() {
    return this.dashboardService.adminDashboard();
  }

  // Số liệu team cho quản lý.
  @Roles("MANAGER")
  @Get("app/dashboard")
  managerDashboard(@CurrentUser() user: AuthUser) {
    return this.dashboardService.managerDashboard(user);
  }

  // Đọc cấu hình hệ thống.
  @Permissions("SYSTEM_SETTING_READ")
  @Get("system-settings")
  getSettings() {
    return this.dashboardService.getSettings();
  }

  // Sửa cấu hình hệ thống (admin).
  @Permissions("SYSTEM_SETTING_UPDATE")
  @Patch("system-settings")
  updateSettings(
    @Body() dto: UpdateSystemSettingsDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext
  ) {
    return this.dashboardService.updateSettings(dto.settings, user, context);
  }
}
