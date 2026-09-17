import { Module } from "@nestjs/common";
import { AttendanceModule } from "../attendance/attendance.module";
import { MailModule } from "../mail/mail.module";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";

@Module({
  imports: [AttendanceModule, MailModule],
  controllers: [PayrollController],
  providers: [PayrollService]
})
export class PayrollModule {}
