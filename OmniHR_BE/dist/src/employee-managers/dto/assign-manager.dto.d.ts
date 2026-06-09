import { ManagerType } from "@prisma/client";
export declare class AssignManagerDto {
    employeeId: number;
    managerId: number;
    managerType?: ManagerType;
    startDate?: string;
}
