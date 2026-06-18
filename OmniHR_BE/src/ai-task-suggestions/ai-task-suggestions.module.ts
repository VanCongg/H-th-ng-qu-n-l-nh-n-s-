import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TaskWorkloadModule } from "../task-workload/task-workload.module";
import { AiTaskSuggestionsController } from "./ai-task-suggestions.controller";
import { AiTaskSuggestionsService } from "./ai-task-suggestions.service";

@Module({
  imports: [PrismaModule, TaskWorkloadModule],
  controllers: [AiTaskSuggestionsController],
  providers: [AiTaskSuggestionsService, AuditService, AccessControlService],
  exports: [AiTaskSuggestionsService]
})
export class AiTaskSuggestionsModule {}
