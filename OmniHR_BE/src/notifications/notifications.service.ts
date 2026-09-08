import { HttpStatus, Injectable } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuthUser } from "../common/types";
import { pagination } from "../common/utils";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationsGateway } from "./notifications.gateway";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway
  ) {}

  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: number
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, message, entityType, entityId }
    });

    this.gateway.emitToUser(userId, notification);

    return notification;
  }

  async findSelf(user: AuthUser, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      isRead: query.isRead
    };
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.notification.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  unreadCount(user: AuthUser) {
    return this.prisma.notification.count({
      where: { userId: user.id, isRead: false }
    });
  }

  async markRead(id: number, user: AuthUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Notification not found",
        "NOTIFICATION_NOT_FOUND"
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true }
    });
    return { success: true };
  }
}
