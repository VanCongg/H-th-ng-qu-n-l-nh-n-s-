import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, AuditService, AccessControlService],
  exports: [TasksService]
})
export class TasksModule {}
