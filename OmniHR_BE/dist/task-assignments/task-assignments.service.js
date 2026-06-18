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
exports.TaskAssignmentsService = void 0;
const common_1 = require("@nestjs/common");
const access_control_service_1 = require("../common/services/access-control.service");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const assignmentInclude = {
    task: {
        include: {
            project: true,
            assignee: { include: { department: true, position: true } }
        }
    },
    assignee: { include: { department: true, position: true } },
    assignedByUser: { select: { id: true, username: true, email: true } }
};
let TaskAssignmentsService = class TaskAssignmentsService {
    prisma;
    accessControl;
    constructor(prisma, accessControl) {
        this.prisma = prisma;
        this.accessControl = accessControl;
    }
    async findAll(query, user) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = await this.buildWhere(query, user);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.taskAssignment.findMany({
                where,
                include: assignmentInclude,
                orderBy: { assignedAt: "desc" },
                skip,
                take
            }),
            this.prisma.taskAssignment.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    async buildWhere(query, user) {
        const base = {
            taskId: query.taskId,
            assigneeId: query.assigneeId,
            assignmentType: query.assignmentType,
            task: { deletedAt: null }
        };
        if (this.accessControl.isAdmin(user)) {
            return base;
        }
        if (this.accessControl.isManager(user)) {
            const teamIds = await this.accessControl.teamEmployeeIds(user);
            return {
                AND: [
                    base,
                    {
                        OR: [
                            { assigneeId: { in: teamIds } },
                            { task: { createdByUserId: user.id } }
                        ]
                    }
                ]
            };
        }
        return {
            AND: [base, { assigneeId: user.employeeId ?? -1 }]
        };
    }
};
exports.TaskAssignmentsService = TaskAssignmentsService;
exports.TaskAssignmentsService = TaskAssignmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        access_control_service_1.AccessControlService])
], TaskAssignmentsService);
//# sourceMappingURL=task-assignments.service.js.map