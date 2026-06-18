import { Module } from "@nestjs/common";
import { AuditService } from "../common/services/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { SkillsController } from "./skills.controller";
import { SkillsService } from "./skills.service";

@Module({
  imports: [PrismaModule],
  controllers: [SkillsController],
  providers: [SkillsService, AuditService],
  exports: [SkillsService]
})
export class SkillsModule {}
