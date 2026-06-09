import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";

@Global()
@Module({
  providers: [PrismaService, AuditService, AccessControlService],
  exports: [PrismaService, AuditService, AccessControlService]
})
export class PrismaModule {}
