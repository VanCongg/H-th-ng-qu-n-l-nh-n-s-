import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
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

  /** With `year`: requests whose leave days touch this month (1-12). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /** Defaults to the current year when only `month` is given. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /** Only approved leave whose owner asked to withdraw it: a manager's to-do list. */
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : undefined))
  @IsBoolean()
  cancelRequested?: boolean;
}
