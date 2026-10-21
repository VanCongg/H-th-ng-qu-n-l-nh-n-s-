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
