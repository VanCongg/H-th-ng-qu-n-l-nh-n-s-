import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionDto } from "./dto/assign-permission.dto";
export declare class RolesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    })[]>;
    findOne(id: number): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    create(dto: CreateRoleDto, actor: AuthUser, context?: RequestContext): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    update(id: number, dto: UpdateRoleDto, actor: AuthUser, context?: RequestContext): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    remove(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    assignPermission(roleId: number, dto: AssignPermissionDto, actor: AuthUser, context?: RequestContext): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    removePermission(roleId: number, permissionId: number, actor: AuthUser, context?: RequestContext): Promise<{
        _count: {
            userRoles: number;
        };
        rolePermissions: ({
            permission: {
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                description: string | null;
            };
        } & {
            roleId: number;
            assignedAt: Date;
            permissionId: number;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystem: boolean;
    }>;
    private ensureAllowedRoleName;
    private ensurePermissions;
    private uniqueIds;
}
