import { Module } from "@nestjs/common";
import { LeaveBalancesModule } from "../leave-balances/leave-balances.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequestsService } from "./leave-requests.service";

@Module({
  imports: [NotificationsModule, LeaveBalancesModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
