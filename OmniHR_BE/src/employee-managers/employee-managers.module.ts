import { Module } from "@nestjs/common";
import { EmployeeManagersController } from "./employee-managers.controller";
import { EmployeeManagersService } from "./employee-managers.service";

@Module({
  controllers: [EmployeeManagersController],
  providers: [EmployeeManagersService]
})
export class EmployeeManagersModule {}
