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
exports.DepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const api_error_1 = require("../common/api-error");
let DepartmentsService = class DepartmentsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    findAll(search) {
        const where = {
            deletedAt: null,
            ...(search
                ? {
                    OR: [
                        { code: { contains: search, mode: "insensitive" } },
                        { name: { contains: search, mode: "insensitive" } }
                    ]
                }
                : {})
        };
        return this.prisma.department.findMany({
            where,
            include: { parent: true, _count: { select: { employees: true } } },
            orderBy: { name: "asc" }
        });
    }
    async tree() {
        const departments = await this.prisma.department.findMany({
            where: { deletedAt: null },
            orderBy: { name: "asc" }
        });
        const byId = new Map();
        const roots = [];
        for (const department of departments) {
            byId.set(department.id, { ...department, children: [] });
        }
        for (const department of byId.values()) {
            if (department.parentId && byId.has(department.parentId)) {
                byId.get(department.parentId).children.push(department);
            }
            else {
                roots.push(department);
            }
        }
        return roots;
    }
    async findOne(id) {
        const department = await this.prisma.department.findFirst({
            where: { id, deletedAt: null },
            include: { parent: true, children: true, _count: { select: { employees: true } } }
        });
        if (!department) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
        }
        return department;
    }
    async create(dto, actor, context) {
        if (dto.parentId) {
            await this.ensureParent(dto.parentId);
        }
        const department = await this.prisma.department.create({
            data: {
                code: dto.code,
                name: dto.name,
                parentId: dto.parentId,
                isActive: dto.isActive ?? true
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_DEPARTMENT",
            entityType: "Department",
            entityId: department.id,
            newValue: department,
            context
        });
        return department;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        if (dto.parentId === id) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Department cannot be its own parent", "VALIDATION_ERROR");
        }
        if (dto.parentId) {
            await this.ensureParent(dto.parentId);
        }
        const department = await this.prisma.department.update({
            where: { id },
            data: {
                code: dto.code,
                name: dto.name,
                parentId: dto.parentId,
                isActive: dto.isActive
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_DEPARTMENT",
            entityType: "Department",
            entityId: id,
            oldValue,
            newValue: department,
            context
        });
        return department;
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.findOne(id);
        const department = await this.prisma.department.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() }
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_DEPARTMENT",
            entityType: "Department",
            entityId: id,
            oldValue,
            context
        });
        return department;
    }
    async ensureParent(id) {
        const parent = await this.prisma.department.findFirst({
            where: { id, deletedAt: null },
            select: { id: true }
        });
        if (!parent) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
        }
    }
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map