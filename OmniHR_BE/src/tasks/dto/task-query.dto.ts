import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional
} from "class-validator";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const TASK_QUICK_FILTERS = ["overdue", "dueSoon", "review", "unassigned"] as const;
export type TaskQuickFilter = (typeof TASK_QUICK_FILTERS)[number];

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

  /**
   * Page by team task instead of by row: each item is a team task with its
   * subtasks, and a team task comes in when it or any of its subtasks match
   * the filters. A team task is never split across two pages this way.
   */
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  groupByRoot?: boolean;

  /** One-tap filters over subtasks; see `quickTaskWhere`. */
  @IsOptional()
  @IsIn(TASK_QUICK_FILTERS)
  quick?: TaskQuickFilter;
}
