import { AuthUser, RequestContext } from "../common/types";
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";
import { PositionsService } from "./positions.service";
export declare class PositionsController {
    private readonly positionsService;
    constructor(positionsService: PositionsService);
    findAll(search?: string, departmentId?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
        _count: {
            employees: number;
        };
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    })[]>;
    findOne(id: number): Promise<{
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
        _count: {
            employees: number;
        };
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    create(dto: CreatePositionDto, user: AuthUser, context: RequestContext): Promise<{
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
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    update(id: number, dto: UpdatePositionDto, user: AuthUser, context: RequestContext): Promise<{
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
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
}
