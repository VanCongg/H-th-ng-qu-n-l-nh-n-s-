import { AuthUser, RequestContext } from "../common/types";
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";
import { PositionsService } from "./positions.service";
export declare class PositionsController {
    private readonly positionsService;
    constructor(positionsService: PositionsService);
    findAll(search?: string): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            employees: number;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    })[]>;
    findOne(id: number): Promise<{
        _count: {
            employees: number;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    create(dto: CreatePositionDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    update(id: number, dto: UpdatePositionDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
}
