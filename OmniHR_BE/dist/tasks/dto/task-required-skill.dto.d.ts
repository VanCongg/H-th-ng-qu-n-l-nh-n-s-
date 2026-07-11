import { SkillProficiency, TaskSkillImportance } from "@prisma/client";
export declare class TaskRequiredSkillDto {
    skillId: number;
    requiredProficiency: SkillProficiency;
    importance: TaskSkillImportance;
}
