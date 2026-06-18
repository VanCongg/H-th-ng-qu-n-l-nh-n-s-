import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { SkillQueryDto } from "./dto/skill-query.dto";
import { UpdateSkillDto } from "./dto/update-skill.dto";
export declare class SkillsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(query: SkillQueryDto): Promise<{
        items: ({
            positionSkills: ({
                position: {
                    deletedAt: Date | null;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    departmentId: number | null;
                };
            } & {
                createdAt: Date;
                positionId: number;
                skillId: number;
            })[];
        } & {
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            category: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number): Promise<{
        positionSkills: ({
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            };
        } & {
            createdAt: Date;
            positionId: number;
            skillId: number;
        })[];
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        description: string | null;
        category: string | null;
    }>;
    create(dto: CreateSkillDto, actor: AuthUser, context?: RequestContext): Promise<{
        positionSkills: ({
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            };
        } & {
            createdAt: Date;
            positionId: number;
            skillId: number;
        })[];
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        description: string | null;
        category: string | null;
    }>;
    update(id: number, dto: UpdateSkillDto, actor: AuthUser, context?: RequestContext): Promise<{
        positionSkills: ({
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            };
        } & {
            createdAt: Date;
            positionId: number;
            skillId: number;
        })[];
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        description: string | null;
        category: string | null;
    }>;
    remove(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        description: string | null;
        category: string | null;
    }>;
    private ensurePositions;
    private uniqueIds;
}
