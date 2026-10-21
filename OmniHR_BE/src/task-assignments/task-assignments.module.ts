import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TaskAssignmentsController } from "./task-assignments.controller";
import { TaskAssignmentsService } from "./task-assignments.service";

@Module({
  imports: [PrismaModule],
  controllers: [TaskAssignmentsController],
  providers: [TaskAssignmentsService, AccessControlService],
  exports: [TaskAssignmentsService]
})
export class TaskAssignmentsModule {}
