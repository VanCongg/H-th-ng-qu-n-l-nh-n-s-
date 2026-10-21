import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { HolidaysService } from "../common/services/holidays.service";
import { SystemSettingsService } from "../common/services/system-settings.service";

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    AccessControlService,
    SystemSettingsService,
    HolidaysService
  ],
  exports: [
    PrismaService,
    AuditService,
    AccessControlService,
    SystemSettingsService,
    HolidaysService
  ]
})
export class PrismaModule {}
