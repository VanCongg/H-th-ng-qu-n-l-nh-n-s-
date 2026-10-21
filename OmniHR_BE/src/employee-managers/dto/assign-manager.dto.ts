import { IsDateString, IsEnum, IsInt, IsOptional } from "class-validator";
import { ManagerType } from "@prisma/client";

export class AssignManagerDto {
  @IsInt()
  employeeId: number;

  @IsInt()
  managerId: number;

  @IsOptional()
  @IsEnum(ManagerType)
  managerType?: ManagerType;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
