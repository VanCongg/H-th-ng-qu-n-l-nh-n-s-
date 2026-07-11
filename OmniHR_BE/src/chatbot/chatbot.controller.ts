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

@ApiTags("chatbot")
@ApiBearerAuth()
@Controller("chatbot")
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post("message")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  sendMessage(
    @Body() dto: ChatbotMessageDto,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext,
  ) {
    return this.chatbotService.sendMessage(dto, user, context);
  }

  @Get("conversations")
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatbotService.listConversations(user);
  }

  @Get("conversations/:id/messages")
  listMessages(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatbotService.listMessages(user, id);
  }

  @Post("actions/:actionId/confirm")
  confirmAction(
    @Param("actionId", ParseIntPipe) actionId: number,
    @CurrentUser() user: AuthUser,
    @ReqContext() context: RequestContext,
  ) {
    return this.chatbotService.confirmAction(actionId, user, context);
  }

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
