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
exports.PositionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const api_error_1 = require("../common/api-error");
const prisma_where_1 = require("../common/prisma-where");
let PositionsService = class PositionsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    findAll(search, departmentId) {
        const where = {
            deletedAt: null,
            departmentId,
            ...(search
                ? {
                    OR: [
                        { code: { contains: search, mode: "insensitive" } },
                        { name: { contains: search, mode: "insensitive" } }
                    ]
                }
                : {})
        };
        return this.prisma.position.findMany({
            where,
            include: {
                department: true,
                _count: { select: { employees: { where: (0, prisma_where_1.currentEmployeeWhere)() } } }
            },
            orderBy: [{ department: { name: "asc" } }, { name: "asc" }]
        });
    }
    async findOne(id) {
        const position = await this.prisma.position.findFirst({
            where: { id, deletedAt: null },
            include: {
                department: true,
                _count: { select: { employees: { where: (0, prisma_where_1.currentEmployeeWhere)() } } }
            }
        });
        if (!position) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Position not found", "POSITION_NOT_FOUND");
        }
        return position;
    }
    async create(dto, actor, context) {
        await this.ensureDepartment(dto.departmentId);
        const position = await this.prisma.position.create({
            data: {
                code: dto.code,
                name: dto.name,
                departmentId: dto.departmentId,
                isActive: dto.isActive ?? true
            },
            include: { department: true }
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_POSITION",
            entityType: "Position",
            entityId: position.id,
            newValue: position,
            context
        });
        return position;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        await this.ensureDepartment(dto.departmentId);
        const position = await this.prisma.position.update({
            where: { id },
            data: {
                code: dto.code,
                name: dto.name,
                departmentId: dto.departmentId,
                isActive: dto.isActive
            },
            include: { department: true }
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_POSITION",
            entityType: "Position",
            entityId: id,
            oldValue,
            newValue: position,
            context
        });
        return position;
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.findOne(id);
        const position = await this.prisma.position.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() }
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_POSITION",
            entityType: "Position",
            entityId: id,
            oldValue,
            context
        });
        return position;
    }
    async ensureDepartment(departmentId) {
        if (!departmentId) {
            return;
        }
        const department = await this.prisma.department.findFirst({
            where: { id: departmentId, deletedAt: null },
            select: { id: true }
        });
        if (!department) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
        }
    }
};
exports.PositionsService = PositionsService;
exports.PositionsService = PositionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PositionsService);
//# sourceMappingURL=positions.service.js.map