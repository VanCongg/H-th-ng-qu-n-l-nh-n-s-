import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateHolidayDto {
  @IsDateString()
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
}

export class HolidayQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
