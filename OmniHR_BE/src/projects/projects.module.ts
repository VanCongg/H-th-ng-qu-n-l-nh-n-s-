import { Module } from "@nestjs/common";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, AuditService, AccessControlService],
  exports: [ProjectsService]
})
export class ProjectsModule {}
