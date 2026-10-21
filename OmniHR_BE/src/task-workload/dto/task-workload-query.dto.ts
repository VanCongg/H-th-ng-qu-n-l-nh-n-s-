// Bộ lọc khối lượng việc: phạm vi (tất cả / team / bản thân).

import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional } from "class-validator";

export type TaskWorkloadScope = "all" | "team" | "self";

export class TaskWorkloadQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsIn(["all", "team", "self"])
  scope?: TaskWorkloadScope;
}
