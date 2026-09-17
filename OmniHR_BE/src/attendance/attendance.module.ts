import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { TimesheetService } from "./timesheet.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, TimesheetService],
  exports: [TimesheetService]
})
export class AttendanceModule {}
