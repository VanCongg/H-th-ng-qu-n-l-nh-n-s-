import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { TaskAssignmentType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class TaskAssignmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @IsEnum(TaskAssignmentType)
  assignmentType?: TaskAssignmentType;
}
