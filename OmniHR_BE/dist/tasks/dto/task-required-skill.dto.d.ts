import { SkillProficiency } from "@prisma/client";
export declare class TaskRequiredSkillDto {
    skillId: number;
    requiredProficiency?: SkillProficiency;
    weight?: number;
    isRequired?: boolean;
}
