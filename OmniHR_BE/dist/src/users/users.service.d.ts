import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
export declare class UsersService {
    private readonly prisma;
    private readonly config;
    private readonly audit;
    constructor(prisma: PrismaService, config: ConfigService, audit: AuditService);
    findAll(query: PaginationQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number): Promise<Record<string, unknown>>;
    create(dto: CreateUserDto, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    update(id: number, dto: UpdateUserDto, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    assignRole(userId: number, dto: AssignRoleDto, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    removeRole(userId: number, roleId: number, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    resetPassword(id: number, dto: ResetUserPasswordDto, actor: AuthUser, context?: RequestContext): Promise<Record<string, unknown>>;
    private ensureUser;
    private ensureRole;
    private saltRounds;
}
