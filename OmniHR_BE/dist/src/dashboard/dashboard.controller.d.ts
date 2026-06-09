import { AuthUser } from "../common/types";
import { DashboardService } from "./dashboard.service";
import { UpdateSystemSettingsDto } from "./dto/update-system-settings.dto";
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
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
                id: number;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                employeeCode: string;
                fullName: string;
                companyEmail: string;
                personalEmail: string | null;
                phone: string | null;
                birthDate: Date;
                hireDate: Date | null;
                status: import(".prisma/client").$Enums.EmployeeStatus;
                departmentId: number | null;
                positionId: number | null;
                userId: number | null;
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
            status: import(".prisma/client").$Enums.LeaveRequestStatus;
            startDate: Date;
            endDate: Date;
            totalDays: number;
            reason: string;
            approvedAt: Date | null;
            rejectionReason: string | null;
            canceledAt: Date | null;
            employeeId: number;
            leaveTypeId: number;
            approverUserId: number | null;
        })[];
        latestSubordinates: ({
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        })[];
    }>;
    getSettings(): Record<string, unknown>;
    updateSettings(dto: UpdateSystemSettingsDto): Record<string, unknown>;
}
