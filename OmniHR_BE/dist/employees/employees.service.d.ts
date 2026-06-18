import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateSelfEmployeeDto } from "./dto/update-self-employee.dto";
export declare class EmployeesService {
    private readonly prisma;
    private readonly config;
    private readonly audit;
    private readonly accessControl;
    constructor(prisma: PrismaService, config: ConfigService, audit: AuditService, accessControl: AccessControlService);
    findAll(query: EmployeeQueryDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findTeam(user: AuthUser, query: EmployeeQueryDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number, user?: AuthUser): Promise<any>;
    myProfile(user: AuthUser): Promise<any>;
    create(dto: CreateEmployeeDto, actor: AuthUser, context?: RequestContext): Promise<{
        employeeId: number;
        userId: number;
        employeeCode: string;
        fullName: string;
        companyEmail: string;
        username: string;
        defaultPassword: string;
        mustChangePassword: boolean;
        employee: any;
    }>;
    update(id: number, dto: UpdateEmployeeDto, actor: AuthUser, context?: RequestContext): Promise<any>;
    updateSelf(user: AuthUser, dto: UpdateSelfEmployeeDto, context?: RequestContext): Promise<any>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<any>;
    resetPassword(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        employeeId: number;
        userId: number;
        username: string;
        defaultPassword: string;
        mustChangePassword: boolean;
    }>;
    setUserActive(id: number, isActive: boolean, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    private buildWhere;
    private ensureEmailAvailable;
    private ensureDepartmentAndPosition;
    private rolesForPosition;
    private syncManagerRoleForPosition;
    private safeEmployee;
    private saltRounds;
}
