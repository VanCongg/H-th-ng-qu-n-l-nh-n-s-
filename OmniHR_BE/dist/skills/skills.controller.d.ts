import { AuthUser, RequestContext } from "../common/types";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { SkillQueryDto } from "./dto/skill-query.dto";
import { UpdateSkillDto } from "./dto/update-skill.dto";
import { SkillsService } from "./skills.service";
export declare class SkillsController {
    private readonly skillsService;
    constructor(skillsService: SkillsService);
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
    create(dto: CreateSkillDto, user: AuthUser, context: RequestContext): Promise<{
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
    update(id: number, dto: UpdateSkillDto, user: AuthUser, context: RequestContext): Promise<{
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
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        description: string | null;
        category: string | null;
    }>;
}
