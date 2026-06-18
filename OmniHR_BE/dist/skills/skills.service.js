"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsService = void 0;
const common_1 = require("@nestjs/common");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const skillInclude = {
    positionSkills: {
        include: { position: true },
        orderBy: [{ position: { code: "asc" } }]
    }
};
let SkillsService = class SkillsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = {
            category: query.category,
            isActive: query.isActive,
            ...(query.search
                ? {
                    OR: [
                        { code: { contains: query.search, mode: "insensitive" } },
                        { name: { contains: query.search, mode: "insensitive" } },
                        { category: { contains: query.search, mode: "insensitive" } }
                    ]
                }
                : {})
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.skill.findMany({
                where,
                include: skillInclude,
                orderBy: [{ isActive: "desc" }, { code: "asc" }],
                skip,
                take
            }),
            this.prisma.skill.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    async findOne(id) {
        const skill = await this.prisma.skill.findUnique({
            where: { id },
            include: skillInclude
        });
        if (!skill) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Skill not found", "SKILL_NOT_FOUND");
        }
        return skill;
    }
    async create(dto, actor, context) {
        const positionIds = this.uniqueIds(dto.positionIds);
        await this.ensurePositions(positionIds);
        const skill = await this.prisma.skill.create({
            data: {
                code: dto.code.toUpperCase(),
                name: dto.name,
                category: dto.category,
                description: dto.description,
                isActive: dto.isActive ?? true,
                positionSkills: positionIds.length
                    ? {
                        create: positionIds.map((positionId) => ({ positionId }))
                    }
                    : undefined
            },
            include: skillInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_SKILL",
            entityType: "Skill",
            entityId: skill.id,
            newValue: skill,
            context
        });
        return skill;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        const positionIds = dto.positionIds ? this.uniqueIds(dto.positionIds) : undefined;
        await this.ensurePositions(positionIds);
        const skill = await this.prisma.$transaction(async (tx) => {
            if (positionIds) {
                await tx.positionSkill.deleteMany({ where: { skillId: id } });
            }
            return tx.skill.update({
                where: { id },
                data: {
                    code: dto.code?.toUpperCase(),
                    name: dto.name,
                    category: dto.category,
                    description: dto.description,
                    isActive: dto.isActive,
                    positionSkills: positionIds?.length
                        ? {
                            create: positionIds.map((positionId) => ({ positionId }))
                        }
                        : undefined
                },
                include: skillInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_SKILL",
            entityType: "Skill",
            entityId: id,
            oldValue,
            newValue: skill,
            context
        });
        return skill;
    }
    async remove(id, actor, context) {
        const oldValue = await this.findOne(id);
        const skill = await this.prisma.skill.update({
            where: { id },
            data: { isActive: false }
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_SKILL",
            entityType: "Skill",
            entityId: id,
            oldValue,
            newValue: skill,
            context
        });
        return skill;
    }
    async ensurePositions(positionIds) {
        if (!positionIds?.length) {
            return;
        }
        const positions = await this.prisma.position.findMany({
            where: { id: { in: positionIds }, deletedAt: null },
            select: { id: true }
        });
        if (positions.length !== positionIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Position not found", "POSITION_NOT_FOUND");
        }
    }
    uniqueIds(ids) {
        return Array.from(new Set(ids ?? []));
    }
};
exports.SkillsService = SkillsService;
exports.SkillsService = SkillsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SkillsService);
//# sourceMappingURL=skills.service.js.map