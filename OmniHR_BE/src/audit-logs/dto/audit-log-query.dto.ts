import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { AUDIT_CATEGORY_KEYS, AuditCategory } from "../../common/audit-actions";
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

  /** One group of actions: security, people, leave, work or AI. */
  @IsOptional()
  @IsIn(AUDIT_CATEGORY_KEYS)
  category?: AuditCategory;

  /** Leave out everyday steps: sign-ins, task status moves, chatbot turns... */
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : value === "false" ? false : value))
  @IsBoolean()
  importantOnly?: boolean;
}
