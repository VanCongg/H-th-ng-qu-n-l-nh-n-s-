import { Type } from "class-transformer";
import { IsEnum, IsInt } from "class-validator";
import { SkillProficiency, TaskSkillImportance } from "@prisma/client";

export class TaskRequiredSkillDto {
  @Type(() => Number)
  @IsInt()
  skillId: number;

  @IsEnum(SkillProficiency)
  requiredProficiency: SkillProficiency;

  @IsEnum(TaskSkillImportance)
  importance: TaskSkillImportance;
}
