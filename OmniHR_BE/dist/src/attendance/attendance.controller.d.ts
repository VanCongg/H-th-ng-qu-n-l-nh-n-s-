import { AuthUser, RequestContext } from "../common/types";
import { AdminCreateAttendanceDto, AdminUpdateAttendanceDto } from "./dto/admin-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AttendanceService } from "./attendance.service";
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    checkIn(user: AuthUser, context: RequestContext): Promise<{
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
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        updatedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        source: string;
        note: string | null;
        isAdjustment: boolean;
        createdByUserId: number | null;
        updatedByUserId: number | null;
    }>;
    checkOut(user: AuthUser, context: RequestContext): Promise<{
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
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        updatedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        source: string;
        note: string | null;
        isAdjustment: boolean;
        createdByUserId: number | null;
        updatedByUserId: number | null;
    }>;
    findAll(query: AttendanceQueryDto): Promise<{
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
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            updatedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            employeeId: number;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            source: string;
            note: string | null;
            isAdjustment: boolean;
            createdByUserId: number | null;
            updatedByUserId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findSelf(user: AuthUser, query: AttendanceQueryDto): Promise<{
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
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            updatedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            employeeId: number;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            source: string;
            note: string | null;
            isAdjustment: boolean;
            createdByUserId: number | null;
            updatedByUserId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findTeam(user: AuthUser, query: AttendanceQueryDto): Promise<{
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
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            updatedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            employeeId: number;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            source: string;
            note: string | null;
            isAdjustment: boolean;
            createdByUserId: number | null;
            updatedByUserId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findByEmployee(employeeId: number, user: AuthUser, query: AttendanceQueryDto): Promise<{
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
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            updatedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            employeeId: number;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            source: string;
            note: string | null;
            isAdjustment: boolean;
            createdByUserId: number | null;
            updatedByUserId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    adminCreate(dto: AdminCreateAttendanceDto, user: AuthUser, context: RequestContext): Promise<{
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
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        updatedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        source: string;
        note: string | null;
        isAdjustment: boolean;
        createdByUserId: number | null;
        updatedByUserId: number | null;
    }>;
    adminUpdate(id: number, dto: AdminUpdateAttendanceDto, user: AuthUser, context: RequestContext): Promise<{
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
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        updatedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        source: string;
        note: string | null;
        isAdjustment: boolean;
        createdByUserId: number | null;
        updatedByUserId: number | null;
    }>;
}
