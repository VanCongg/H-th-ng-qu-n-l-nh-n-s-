import { ProjectStatus } from "@prisma/client";
export declare class CreateProjectDto {
    code: string;
    name: string;
    description?: string;
    status?: ProjectStatus;
    startDate?: string;
    endDate?: string;
}
