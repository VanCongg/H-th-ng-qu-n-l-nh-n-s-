import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { CareerLevel, EmployeeStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class EmployeeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  positionId?: number;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsEnum(CareerLevel)
  careerLevel?: CareerLevel;
}
