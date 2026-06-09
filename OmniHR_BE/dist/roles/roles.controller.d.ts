import { AuthUser, RequestContext } from "../common/types";
import { AssignPermissionDto } from "./dto/assign-permission.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
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
    create(dto: CreateRoleDto, user: AuthUser, context: RequestContext): Promise<{
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
    update(id: number, dto: UpdateRoleDto, user: AuthUser, context: RequestContext): Promise<{
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
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
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
    assignPermission(id: number, dto: AssignPermissionDto, user: AuthUser, context: RequestContext): Promise<{
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
    removePermission(id: number, permissionId: number, user: AuthUser, context: RequestContext): Promise<{
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
}
