import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const MAX_SALARY = 2_000_000_000;

export class CompensationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;
}

export class UpsertCompensationDto {
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  baseSalary: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  allowance?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  insuranceSalary?: number | null;
}

export class CreatePayrollPeriodDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class SendPayslipsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  employeeIds?: number[];

  @IsOptional()
  @IsBoolean()
  onlyUnsent?: boolean;
}
