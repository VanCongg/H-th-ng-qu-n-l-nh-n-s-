import { Module } from "@nestjs/common";
import { AuditService } from "../common/services/audit.service";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, AuditService]
})
export class TeamsModule {}
