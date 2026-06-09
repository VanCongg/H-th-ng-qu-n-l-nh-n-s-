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
exports.AccessControlService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../api-error");
let AccessControlService = class AccessControlService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isAdmin(user) {
        return user.roles.includes("ADMIN");
    }
    isManager(user) {
        return user.roles.includes("MANAGER");
    }
    async ensureCanReadEmployee(user, employeeId) {
        if (this.isAdmin(user)) {
            return;
        }
        if (user.employeeId === employeeId) {
            return;
        }
        if (await this.isSubordinate(user, employeeId)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Manager scope denied", "MANAGER_SCOPE_DENIED");
    }
    async ensureCanManageLeave(user, employeeId) {
        if (this.isAdmin(user)) {
            return;
        }
        if (user.employeeId === employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "You cannot approve or reject your own leave request", "MANAGER_SCOPE_DENIED");
        }
        if (!(await this.isSubordinate(user, employeeId))) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Manager scope denied", "MANAGER_SCOPE_DENIED");
        }
    }
    async teamEmployeeIds(user) {
        if (!user.employeeId) {
            return [];
        }
        const rows = await this.prisma.employeeManager.findMany({
            where: {
                managerId: user.employeeId,
                isActive: true,
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
            },
            select: { employeeId: true }
        });
        return rows.map((row) => row.employeeId);
    }
    async isSubordinate(user, employeeId) {
        if (!user.employeeId) {
            return false;
        }
        const relation = await this.prisma.employeeManager.findFirst({
            where: {
                employeeId,
                managerId: user.employeeId,
                isActive: true,
                OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
            },
            select: { id: true }
        });
        return Boolean(relation);
    }
};
exports.AccessControlService = AccessControlService;
exports.AccessControlService = AccessControlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccessControlService);
//# sourceMappingURL=access-control.service.js.map