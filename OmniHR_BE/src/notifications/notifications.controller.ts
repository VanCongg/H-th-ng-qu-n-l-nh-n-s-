// API thông báo của người dùng: danh sách, số chưa đọc, đánh dấu đã đọc, đăng ký thiết bị nhận push.

import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { RegisterPushDeviceDto, RemovePushDeviceDto } from "./dto/push-device.dto";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly push: PushService
  ) {}

  /** Registers this phone for push messages; call again when the token or language changes. */
  @Post("devices")
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushDeviceDto) {
    return this.push.registerDevice(user.id, dto.token, dto.platform, dto.language ?? "vi");
  }

  /** Stops push to this phone, e.g. before signing out of it. */
  @Delete("devices")
  async removeDevice(@CurrentUser() user: AuthUser, @Body() dto: RemovePushDeviceDto) {
    await this.push.removeDevice(user.id, dto.token);
    return { removed: true };
  }

  // Thông báo của chính mình.
  @Get()
  findSelf(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findSelf(user, query);
  }

  // Số thông báo chưa đọc (hiện trên chuông).
  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user);
  }

  // Đánh dấu một thông báo đã đọc.
  @Patch(":id/read")
  markRead(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user);
  }

  // Đánh dấu tất cả đã đọc.
  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user);
  }
}
