import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { PerformanceReviewStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class PerformanceReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cycleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsEnum(PerformanceReviewStatus)
  status?: PerformanceReviewStatus;
}
