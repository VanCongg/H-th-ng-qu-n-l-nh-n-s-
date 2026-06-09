import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
export declare class DashboardService {
    private readonly prisma;
    private readonly accessControl;
    private settings;
    constructor(prisma: PrismaService, accessControl: AccessControlService);
    adminDashboard(): Promise<{
        totalEmployees: number;
        totalDepartments: number;
        totalPositions: number;
        activeUsers: number;
        pendingLeaveRequests: number;
        todayAttendanceRecords: number;
        recentAuditLogs: ({
            user: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            userId: number | null;
            action: string;
            entityType: string;
            id: number;
            entityId: string | null;
            oldValue: import("@prisma/client/runtime/library").JsonValue | null;
            newValue: import("@prisma/client/runtime/library").JsonValue | null;
            ipAddress: string | null;
            userAgent: string | null;
            createdAt: Date;
        })[];
    }>;
    managerDashboard(user: AuthUser): Promise<{
        teamEmployees: number;
        pendingTeamLeaves: number;
        todayTeamAttendance: number;
        latestTeamLeaves: ({
            employee: {
                userId: number | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                departmentId: number | null;
                employeeCode: string;
                fullName: string;
                companyEmail: string;
                personalEmail: string | null;
                phone: string | null;
                birthDate: Date;
                hireDate: Date | null;
                status: import(".prisma/client").$Enums.EmployeeStatus;
                positionId: number | null;
            };
            leaveType: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                name: string;
                code: string;
                annualAllowance: number | null;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            employeeId: number;
            startDate: Date;
            endDate: Date;
            status: import(".prisma/client").$Enums.LeaveRequestStatus;
            leaveTypeId: number;
            totalDays: number;
            reason: string;
            approverUserId: number | null;
            approvedAt: Date | null;
            rejectionReason: string | null;
            canceledAt: Date | null;
        })[];
        latestSubordinates: ({
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        })[];
    }>;
    getSettings(): Record<string, unknown>;
    updateSettings(settings: Record<string, unknown>): Record<string, unknown>;
}
