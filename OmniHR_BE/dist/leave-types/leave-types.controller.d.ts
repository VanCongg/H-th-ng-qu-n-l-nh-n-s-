import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { LeaveTypesService } from "./leave-types.service";
export declare class LeaveTypesController {
    private readonly leaveTypesService;
    constructor(leaveTypesService: LeaveTypesService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    create(dto: CreateLeaveTypeDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    update(id: number, dto: UpdateLeaveTypeDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
}
