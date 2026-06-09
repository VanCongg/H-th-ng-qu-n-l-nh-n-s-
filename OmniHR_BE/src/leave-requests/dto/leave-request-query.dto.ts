import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional } from "class-validator";
import { LeaveRequestStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class LeaveRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leaveTypeId?: number;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
