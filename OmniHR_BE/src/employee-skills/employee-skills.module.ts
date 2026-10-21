import { Module } from "@nestjs/common";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmployeeSkillsController } from "./employee-skills.controller";
import { EmployeeSkillsService } from "./employee-skills.service";

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeSkillsController],
  providers: [EmployeeSkillsService, AuditService, AccessControlService],
  exports: [EmployeeSkillsService]
})
export class EmployeeSkillsModule {}
