import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { LeaveRequestQueryDto } from "./dto/leave-request-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
export declare class LeaveRequestsService {
    private readonly prisma;
    private readonly audit;
    private readonly accessControl;
    constructor(prisma: PrismaService, audit: AuditService, accessControl: AccessControlService);
    create(dto: CreateLeaveRequestDto, user: AuthUser, context?: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    findAll(query: LeaveRequestQueryDto): Promise<{
        items: ({
            employee: {
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findSelf(user: AuthUser, query: LeaveRequestQueryDto): Promise<{
        items: ({
            employee: {
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findTeam(user: AuthUser, query: LeaveRequestQueryDto): Promise<{
        items: ({
            employee: {
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number, user: AuthUser): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    approve(id: number, user: AuthUser, context?: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    reject(id: number, dto: RejectLeaveRequestDto, user: AuthUser, context?: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    cancel(id: number, user: AuthUser, context?: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    private findPendingForDecision;
    private paginatedList;
    private buildWhere;
    private ensureNoOverlap;
    private requireEmployee;
}
