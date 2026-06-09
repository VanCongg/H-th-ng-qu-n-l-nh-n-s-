import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
