import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { LeaveBalanceStatus } from "../leave-accrual";

export const LEAVE_BALANCE_STATUSES: LeaveBalanceStatus[] = ["AVAILABLE", "LOW", "EXHAUSTED"];
export const LEAVE_BALANCE_SORTS = ["code", "remainingAsc", "remainingDesc"] as const;
export type LeaveBalanceSort = (typeof LEAVE_BALANCE_SORTS)[number];

export class LeaveBalanceYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class LeaveBalanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsIn(LEAVE_BALANCE_STATUSES)
  balance?: LeaveBalanceStatus;

  @IsOptional()
  @IsIn(LEAVE_BALANCE_SORTS)
  sortBy?: LeaveBalanceSort;
}
