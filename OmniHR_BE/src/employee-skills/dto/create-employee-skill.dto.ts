import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from "class-validator";
import { SkillProficiency } from "@prisma/client";

export class CreateEmployeeSkillDto {
  @Type(() => Number)
  @IsInt()
  skillId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsEnum(SkillProficiency)
  proficiency?: SkillProficiency;

  @IsOptional()
  @IsDateString()
  lastUsedAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
