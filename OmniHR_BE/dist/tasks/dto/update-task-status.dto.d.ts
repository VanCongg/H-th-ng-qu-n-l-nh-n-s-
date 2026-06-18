import { TaskStatus } from "@prisma/client";
export declare class UpdateTaskStatusDto {
    status: TaskStatus;
    note?: string;
}
