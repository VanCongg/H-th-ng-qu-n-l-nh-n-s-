import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { LeaveRequestQueryDto } from "./dto/leave-request-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { LeaveRequestsService } from "./leave-requests.service";
export declare class LeaveRequestsController {
    private readonly leaveRequestsService;
    constructor(leaveRequestsService: LeaveRequestsService);
    create(dto: CreateLeaveRequestDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    findAll(query: LeaveRequestQueryDto): Promise<{
        items: ({
            employee: {
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
            approver: {
                id: number;
                username: string;
                email: string;
            } | null;
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    approve(id: number, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    reject(id: number, dto: RejectLeaveRequestDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
    cancel(id: number, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        approver: {
            id: number;
            username: string;
            email: string;
        } | null;
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
    }>;
}
