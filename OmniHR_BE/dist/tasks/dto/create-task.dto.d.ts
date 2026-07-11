import { TaskPriority, TaskStatus } from "@prisma/client";
import { TaskRequiredSkillDto } from "./task-required-skill.dto";
export declare class CreateTaskDto {
    parentTaskId?: number;
    projectId?: number;
    teamId?: number;
    title: string;
    description?: string;
    technologies?: string[];
    priority?: TaskPriority;
    status?: TaskStatus;
    assigneeId?: number;
    startDate?: string;
    dueDate?: string;
    estimatedHours?: number;
    actualHours?: number;
    requiredSkills?: TaskRequiredSkillDto[];
}
