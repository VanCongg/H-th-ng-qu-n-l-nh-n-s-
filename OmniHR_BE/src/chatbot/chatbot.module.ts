import { Module } from "@nestjs/common";
import { LeaveRequestsModule } from "../leave-requests/leave-requests.module";
import { ChatbotAiClientService } from "./chatbot-ai-client.service";
import { ChatbotController } from "./chatbot.controller";
import { ChatbotHistoryService } from "./chatbot-history.service";
import { ChatbotService } from "./chatbot.service";
import { ChatbotToolsService } from "./chatbot-tools.service";

@Module({
  imports: [LeaveRequestsModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    ChatbotAiClientService,
    ChatbotHistoryService,
    ChatbotToolsService,
  ],
})
export class ChatbotModule {}
