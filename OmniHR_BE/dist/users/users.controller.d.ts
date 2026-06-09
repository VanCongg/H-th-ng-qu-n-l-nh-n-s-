import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AuthUser, RequestContext } from "../common/types";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(query: PaginationQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number): Promise<Record<string, unknown>>;
    create(dto: CreateUserDto, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    update(id: number, dto: UpdateUserDto, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    assignRole(id: number, dto: AssignRoleDto, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    removeRole(id: number, roleId: number, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
    resetPassword(id: number, dto: ResetUserPasswordDto, user: AuthUser, context: RequestContext): Promise<Record<string, unknown>>;
}
