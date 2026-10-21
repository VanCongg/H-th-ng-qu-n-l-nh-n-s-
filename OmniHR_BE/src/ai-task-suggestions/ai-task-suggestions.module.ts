// Module gợi ý giao việc bằng AI.

import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TaskWorkloadModule } from "../task-workload/task-workload.module";
import { AiTaskSuggestionsController } from "./ai-task-suggestions.controller";
import { AiTaskSuggestionsService } from "./ai-task-suggestions.service";
import { SuggestionExplainerClient } from "./suggestion-explainer.client";

@Module({
  imports: [PrismaModule, TaskWorkloadModule, NotificationsModule],
  controllers: [AiTaskSuggestionsController],
  providers: [
    AiTaskSuggestionsService,
    AuditService,
    AccessControlService,
    SystemSettingsService,
    SuggestionExplainerClient
  ],
  exports: [AiTaskSuggestionsService]
})
export class AiTaskSuggestionsModule {}
