import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { SkillProficiency } from "@prisma/client";

export class TaskRequiredSkillDto {
  @Type(() => Number)
  @IsInt()
  skillId: number;

  @IsOptional()
  @IsEnum(SkillProficiency)
  requiredProficiency?: SkillProficiency;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
