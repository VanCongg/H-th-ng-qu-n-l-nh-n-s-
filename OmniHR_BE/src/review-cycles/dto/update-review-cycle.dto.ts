import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ReviewCycleStatus } from "@prisma/client";

export class UpdateReviewCycleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ReviewCycleStatus)
  status?: ReviewCycleStatus;
}
