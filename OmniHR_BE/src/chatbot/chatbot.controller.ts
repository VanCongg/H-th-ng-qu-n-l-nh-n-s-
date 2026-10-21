import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ReqContext } from "../common/decorators/request-context.decorator";
import { AuthUser, RequestContext } from "../common/types";
import { ChatbotService } from "./chatbot.service";
import { ChatbotCancelActionDto } from "./dto/chatbot-cancel-action.dto";
import { ChatbotMessageDto } from "./dto/chatbot-message.dto";

/**
 * Cổng HTTP của HRGenie cho app mobile. App chỉ gọi NestJS, không bao giờ gọi
 * thẳng AI service. Mọi endpoint đều cần đăng nhập (JWT guard toàn cục), và
 * người dùng chỉ thao tác được trên hội thoại / bản nháp của chính mình.
 */
@ApiTags("chatbot")
@ApiBearerAuth()
@Controller("chatbot")
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /** Gửi một tin nhắn cho HRGenie. Giới hạn 20 tin/phút cho mỗi người. */
  @Post("message")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  sendMessage(
    @Body() dto: ChatbotMessageDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext,
  ) {
    return this.chatbotService.sendMessage(dto, user, context);
  }

  /** Danh sách hội thoại của người dùng, mới nhất trước. */
  @Get("conversations")
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatbotService.listConversations(user);
  }

  /** Toàn bộ tin nhắn của một hội thoại (chỉ chủ hội thoại xem được). */
  @Get("conversations/:id/messages")
  listMessages(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatbotService.listMessages(user, id);
  }

  /**
   * Người dùng bấm "Xác nhận" trên thẻ bản nháp: lúc này mới thật sự ghi dữ liệu
   * (nộp đơn nghỉ, hủy đơn, đổi trạng thái task).
   */
  @Post("actions/:actionId/confirm")
  confirmAction(
    @Param("actionId", ParseIntPipe) actionId: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext,
  ) {
    return this.chatbotService.confirmAction(actionId, user, context);
  }

  /** Người dùng bấm "Hủy": bỏ bản nháp, không ghi gì vào dữ liệu nghiệp vụ. */
  @Post("actions/:actionId/cancel")
  cancelAction(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Body() dto: ChatbotCancelActionDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext,
  ) {
    return this.chatbotService.cancelAction(actionId, dto, user, context);
  }
}
