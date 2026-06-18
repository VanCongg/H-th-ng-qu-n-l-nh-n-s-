import { TaskPriority, TaskStatus } from "@prisma/client";
import { TaskRequiredSkillDto } from "./task-required-skill.dto";
export declare class CreateTaskDto {
    projectId?: number;
    departmentId?: number;
    teamId?: number;
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    assigneeId?: number;
    startDate?: string;
    dueDate?: string;
    estimatedHours?: number;
    actualHours?: number;
    requiredSkills?: TaskRequiredSkillDto[];
}
