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
exports.AuditLogsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const utils_1 = require("../common/utils");
let AuditLogsService = class AuditLogsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = {
            userId: query.userId,
            action: query.action
                ? { contains: query.action, mode: "insensitive" }
                : undefined,
            entityType: query.entityType,
            createdAt: query.fromDate || query.toDate
                ? {
                    gte: query.fromDate ? new Date(query.fromDate) : undefined,
                    lte: query.toDate ? new Date(query.toDate) : undefined
                }
                : undefined
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, username: true, email: true }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take
            }),
            this.prisma.auditLog.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
};
exports.AuditLogsService = AuditLogsService;
exports.AuditLogsService = AuditLogsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogsService);
//# sourceMappingURL=audit-logs.service.js.map