import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional } from "class-validator";
import { AttendanceRecordType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AttendanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(AttendanceRecordType)
  recordType?: AttendanceRecordType;
}
