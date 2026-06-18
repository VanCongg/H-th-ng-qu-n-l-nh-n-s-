import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
import { TaskWorkloadQueryDto } from "./dto/task-workload-query.dto";
export type WorkloadSummary = {
    employeeId: number;
    activeTaskCount: number;
    totalEstimatedHours: number;
    overdueTaskCount: number;
    capacityHoursPerWeek: number;
    availableHours: number;
    workloadScore: number;
};
export declare class TaskWorkloadService {
    private readonly prisma;
    private readonly accessControl;
    constructor(prisma: PrismaService, accessControl: AccessControlService);
    findAll(user: AuthUser, query: TaskWorkloadQueryDto): Promise<{
        employee: {
            department: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                managerId: number | null;
                parentId: number | null;
            } | null;
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            } | null;
        } & {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            avatarUrl: string | null;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
            careerLevel: import(".prisma/client").$Enums.CareerLevel;
        };
        workload: WorkloadSummary;
    }[]>;
    summariesForEmployees(employeeIds: number[]): Promise<Map<number, WorkloadSummary>>;
    summaryForEmployee(employeeId: number): Promise<WorkloadSummary>;
    private emptySummary;
    private baseWorkloadScore;
    private singleEmployeeScope;
    private employeeScope;
    private defaultEmployeeScope;
}
