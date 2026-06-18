import { ProjectStatus } from "@prisma/client";
export declare class CreateProjectDto {
    departmentId?: number;
    teamId?: number;
    managerId?: number;
    code: string;
    name: string;
    description?: string;
    status?: ProjectStatus;
    startDate?: string;
    endDate?: string;
}
