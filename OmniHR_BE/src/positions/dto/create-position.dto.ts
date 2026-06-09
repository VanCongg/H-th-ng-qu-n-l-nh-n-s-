import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreatePositionDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
