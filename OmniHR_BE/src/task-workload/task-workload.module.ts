import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { PrismaModule } from "../prisma/prisma.module";
import { TaskWorkloadController } from "./task-workload.controller";
import { TaskWorkloadService } from "./task-workload.service";

@Module({
  imports: [PrismaModule],
  controllers: [TaskWorkloadController],
  providers: [TaskWorkloadService, AccessControlService],
  exports: [TaskWorkloadService]
})
export class TaskWorkloadModule {}
