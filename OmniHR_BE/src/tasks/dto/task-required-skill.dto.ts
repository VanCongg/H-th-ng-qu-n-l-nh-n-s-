// Một kỹ năng yêu cầu của task: kỹ năng, trình độ cần có, mức quan trọng (bắt buộc / nên có).

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
