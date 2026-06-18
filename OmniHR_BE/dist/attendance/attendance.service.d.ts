import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { AttendanceActionDto } from "./dto/attendance-action.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AdminCreateAttendanceDto, AdminUpdateAttendanceDto } from "./dto/admin-attendance.dto";
export declare class AttendanceService {
    private readonly prisma;
    private readonly audit;
    private readonly accessControl;
    private readonly systemSettings;
    constructor(prisma: PrismaService, audit: AuditService, accessControl: AccessControlService, systemSettings: SystemSettingsService);
    checkIn(user: AuthUser, dto: AttendanceActionDto, context?: RequestContext): Promise<{
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
        createdByUserId: number | null;
        shift: import(".prisma/client").$Enums.AttendanceShift | null;
        note: string | null;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        latitude: number | null;
        longitude: number | null;
        address: string | null;
        attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
        distanceMeters: number | null;
        source: string;
        isAdjustment: boolean;
        updatedByUserId: number | null;
    }>;
    checkOut(user: AuthUser, dto: AttendanceActionDto, context?: RequestContext): Promise<{
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
        createdByUserId: number | null;
        shift: import(".prisma/client").$Enums.AttendanceShift | null;
        note: string | null;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        latitude: number | null;
        longitude: number | null;
        address: string | null;
        attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
        distanceMeters: number | null;
        source: string;
        isAdjustment: boolean;
        updatedByUserId: number | null;
    }>;
    findAll(query: AttendanceQueryDto): Promise<{
        items: ({
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
            createdByUserId: number | null;
            shift: import(".prisma/client").$Enums.AttendanceShift | null;
            note: string | null;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            latitude: number | null;
            longitude: number | null;
            address: string | null;
            attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
            distanceMeters: number | null;
            source: string;
            isAdjustment: boolean;
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
            createdByUserId: number | null;
            shift: import(".prisma/client").$Enums.AttendanceShift | null;
            note: string | null;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            latitude: number | null;
            longitude: number | null;
            address: string | null;
            attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
            distanceMeters: number | null;
            source: string;
            isAdjustment: boolean;
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
            createdByUserId: number | null;
            shift: import(".prisma/client").$Enums.AttendanceShift | null;
            note: string | null;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            latitude: number | null;
            longitude: number | null;
            address: string | null;
            attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
            distanceMeters: number | null;
            source: string;
            isAdjustment: boolean;
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
            createdByUserId: number | null;
            shift: import(".prisma/client").$Enums.AttendanceShift | null;
            note: string | null;
            workDate: Date;
            recordType: import(".prisma/client").$Enums.AttendanceRecordType;
            recordedAt: Date;
            latitude: number | null;
            longitude: number | null;
            address: string | null;
            attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
            distanceMeters: number | null;
            source: string;
            isAdjustment: boolean;
            updatedByUserId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    adminCreate(dto: AdminCreateAttendanceDto, actor: AuthUser, context?: RequestContext): Promise<{
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
        createdByUserId: number | null;
        shift: import(".prisma/client").$Enums.AttendanceShift | null;
        note: string | null;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        latitude: number | null;
        longitude: number | null;
        address: string | null;
        attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
        distanceMeters: number | null;
        source: string;
        isAdjustment: boolean;
        updatedByUserId: number | null;
    }>;
    adminUpdate(id: number, dto: AdminUpdateAttendanceDto, actor: AuthUser, context?: RequestContext): Promise<{
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
        createdByUserId: number | null;
        shift: import(".prisma/client").$Enums.AttendanceShift | null;
        note: string | null;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        latitude: number | null;
        longitude: number | null;
        address: string | null;
        attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
        distanceMeters: number | null;
        source: string;
        isAdjustment: boolean;
        updatedByUserId: number | null;
    }>;
    findOne(id: number): Promise<{
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
        createdByUserId: number | null;
        shift: import(".prisma/client").$Enums.AttendanceShift | null;
        note: string | null;
        workDate: Date;
        recordType: import(".prisma/client").$Enums.AttendanceRecordType;
        recordedAt: Date;
        latitude: number | null;
        longitude: number | null;
        address: string | null;
        attendanceStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
        distanceMeters: number | null;
        source: string;
        isAdjustment: boolean;
        updatedByUserId: number | null;
    }>;
    private paginatedList;
    private buildWhere;
    private ensureValidAttendanceAction;
    private buildCheckInMetadata;
    private buildCheckOutMetadata;
    private buildManualMetadata;
    private resolveCheckInShift;
    private resolveShiftForTime;
    private shiftDefinitions;
    private resolveLocation;
    private workDateFor;
    private localMinutes;
    private parseTime;
    private distanceMeters;
    private toRadians;
    private ensureEmployee;
    private requireEmployee;
    private invalidAction;
}
