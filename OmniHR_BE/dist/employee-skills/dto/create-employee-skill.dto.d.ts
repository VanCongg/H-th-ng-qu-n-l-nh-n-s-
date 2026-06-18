import { SkillProficiency } from "@prisma/client";
export declare class CreateEmployeeSkillDto {
    skillId: number;
    yearsExperience?: number;
    proficiency?: SkillProficiency;
    lastUsedAt?: string;
    note?: string;
}
