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
exports.PoliciesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const api_error_1 = require("../common/api-error");
let PoliciesService = class PoliciesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    findAll() {
        return this.prisma.policy.findMany({ orderBy: { createdAt: "desc" } });
    }
    async findOne(id) {
        const policy = await this.prisma.policy.findUnique({ where: { id } });
        if (!policy) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Policy not found", "POLICY_NOT_FOUND");
        }
        return policy;
    }
    async create(dto, actor, context) {
        const policy = await this.prisma.policy.create({
            data: {
                name: dto.name,
                description: dto.description,
                resource: dto.resource,
                action: dto.action,
                effect: dto.effect ?? "ALLOW",
                condition: dto.condition,
                isActive: dto.isActive ?? true
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_POLICY",
            entityType: "Policy",
            entityId: policy.id,
            newValue: policy,
            context
        });
        return policy;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        const policy = await this.prisma.policy.update({
            where: { id },
            data: {
                name: dto.name,
                description: dto.description,
                resource: dto.resource,
                action: dto.action,
                effect: dto.effect,
                condition: dto.condition,
                isActive: dto.isActive
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_POLICY",
            entityType: "Policy",
            entityId: id,
            oldValue,
            newValue: policy,
            context
        });
        return policy;
    }
    async remove(id, actor, context) {
        const policy = await this.findOne(id);
        await this.prisma.policy.delete({ where: { id } });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_POLICY",
            entityType: "Policy",
            entityId: id,
            oldValue: policy,
            context
        });
        return policy;
    }
};
exports.PoliciesService = PoliciesService;
exports.PoliciesService = PoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PoliciesService);
//# sourceMappingURL=policies.service.js.map