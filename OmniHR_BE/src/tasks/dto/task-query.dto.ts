import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional
} from "class-validator";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

function toOptionalBoolean(value: unknown) {
  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}

export class TaskQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentTaskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  /**
   * Keep tasks that have no due date at all in the result when `fromDate` /
   * `toDate` narrow it to a period. A month-at-a-time view would otherwise
   * drop them from every single period, since `dueDate` is nullable.
   */
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeUndated?: boolean;

  /**
   * Keep every unfinished task in the result whatever its due date, next to
   * the ones due in `fromDate` / `toDate`. A "this period plus what is still
   * open" view, so work that slipped past an earlier deadline stays visible.
   */
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeOpen?: boolean;
}
