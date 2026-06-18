import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
export declare class DashboardService {
    private readonly prisma;
    private readonly accessControl;
    private readonly systemSettings;
    constructor(prisma: PrismaService, accessControl: AccessControlService, systemSettings: SystemSettingsService);
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
            id: number;
            createdAt: Date;
            userId: number | null;
            action: string;
            entityType: string;
            entityId: string | null;
            oldValue: import("@prisma/client/runtime/library").JsonValue | null;
            newValue: import("@prisma/client/runtime/library").JsonValue | null;
            ipAddress: string | null;
            userAgent: string | null;
        })[];
    }>;
    managerDashboard(user: AuthUser): Promise<{
        teamEmployees: number;
        pendingTeamLeaves: number;
        todayTeamAttendance: number;
        latestTeamLeaves: ({
            employee: {
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
            leaveType: {
                id: number;
                isActive: boolean;
                createdAt: Date;
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
        })[];
    }>;
    getSettings(): Promise<import("../common/services/system-settings.service").SystemSettings>;
    updateSettings(settings: Record<string, unknown>): Promise<import("../common/services/system-settings.service").SystemSettings>;
}
