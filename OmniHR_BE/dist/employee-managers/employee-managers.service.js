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
exports.EmployeeManagersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const includeEmployees = {
    employee: { include: { department: true, position: true } },
    manager: { include: { department: true, position: true } }
};
let EmployeeManagersService = class EmployeeManagersService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    findAll() {
        return this.prisma.employeeManager.findMany({
            where: {
                employee: (0, prisma_where_1.currentEmployeeWhere)(),
                manager: (0, prisma_where_1.currentEmployeeWhere)()
            },
            include: includeEmployees,
            orderBy: { createdAt: "desc" }
        });
    }
    async findByEmployee(employeeId) {
        await this.ensureEmployee(employeeId);
        return this.prisma.employeeManager.findMany({
            where: {
                employeeId,
                employee: (0, prisma_where_1.currentEmployeeWhere)(),
                manager: (0, prisma_where_1.currentEmployeeWhere)()
            },
            include: includeEmployees,
            orderBy: { createdAt: "desc" }
        });
    }
    async findSubordinates(managerId) {
        await this.ensureEmployee(managerId);
        const today = (0, utils_1.toDateOnly)(new Date());
        return this.prisma.employeeManager.findMany({
            where: {
                managerId,
                isActive: true,
                employee: (0, prisma_where_1.currentEmployeeWhere)(),
                manager: (0, prisma_where_1.currentEmployeeWhere)(),
                OR: [{ endDate: null }, { endDate: { gte: today } }]
            },
            include: includeEmployees,
            orderBy: { createdAt: "desc" }
        });
    }
    async assign(dto, actor, context) {
        if (dto.employeeId === dto.managerId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee cannot manage themselves", "VALIDATION_ERROR");
        }
        await this.ensureEmployee(dto.employeeId);
        await this.ensureEmployee(dto.managerId);
        const managerType = dto.managerType ?? client_1.ManagerType.DIRECT;
        await this.ensureNoActiveRelation(dto.employeeId, dto.managerId, managerType);
        if (managerType === client_1.ManagerType.DIRECT) {
            await this.ensureNoActiveDirectManager(dto.employeeId);
        }
        const relation = await this.prisma.employeeManager.create({
            data: {
                employeeId: dto.employeeId,
                managerId: dto.managerId,
                managerType,
                startDate: dto.startDate ? (0, utils_1.toDateOnly)(dto.startDate) : (0, utils_1.toDateOnly)(new Date()),
                isActive: true
            },
            include: includeEmployees
        });
        await this.audit.log({
            userId: actor.id,
            action: "ASSIGN_MANAGER",
            entityType: "EmployeeManager",
            entityId: relation.id,
            newValue: relation,
            context
        });
        return relation;
    }
    async end(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        if (!oldValue.isActive) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Manager relationship is already inactive", "MANAGER_RELATION_INACTIVE");
        }
        const endDate = dto.endDate ? (0, utils_1.toDateOnly)(dto.endDate) : (0, utils_1.toDateOnly)(new Date());
        if (endDate < (0, utils_1.toDateOnly)(oldValue.startDate)) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "End date cannot be before start date", "VALIDATION_ERROR");
        }
        const relation = await this.prisma.employeeManager.update({
            where: { id },
            data: {
                isActive: false,
                endDate
            },
            include: includeEmployees
        });
        await this.audit.log({
            userId: actor.id,
            action: "REMOVE_MANAGER",
            entityType: "EmployeeManager",
            entityId: id,
            oldValue,
            newValue: relation,
            context
        });
        return relation;
    }
    async findOne(id) {
        const relation = await this.prisma.employeeManager.findUnique({
            where: { id },
            include: includeEmployees
        });
        if (!relation) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Manager relationship not found", "VALIDATION_ERROR");
        }
        return relation;
    }
    activeRelationWhere(employeeId) {
        const today = (0, utils_1.toDateOnly)(new Date());
        return {
            employeeId,
            isActive: true,
            manager: (0, prisma_where_1.currentEmployeeWhere)(),
            OR: [{ endDate: null }, { endDate: { gte: today } }]
        };
    }
    async ensureNoActiveRelation(employeeId, managerId, managerType) {
        const existing = await this.prisma.employeeManager.findFirst({
            where: {
                ...this.activeRelationWhere(employeeId),
                managerId,
                managerType
            },
            select: { id: true }
        });
        if (existing) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Manager relationship already exists", "MANAGER_RELATION_EXISTS");
        }
    }
    async ensureNoActiveDirectManager(employeeId) {
        const existing = await this.prisma.employeeManager.findFirst({
            where: {
                ...this.activeRelationWhere(employeeId),
                managerType: client_1.ManagerType.DIRECT
            },
            select: { id: true }
        });
        if (existing) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee already has an active direct manager", "DIRECT_MANAGER_EXISTS");
        }
    }
    async ensureEmployee(id) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            select: { id: true }
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
    }
};
exports.EmployeeManagersService = EmployeeManagersService;
exports.EmployeeManagersService = EmployeeManagersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmployeeManagersService);
//# sourceMappingURL=employee-managers.service.js.map