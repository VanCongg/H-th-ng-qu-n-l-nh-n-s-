import { Prisma } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { TaskAssignmentQueryDto } from "./dto/task-assignment-query.dto";
export declare class TaskAssignmentsService {
    private readonly prisma;
    private readonly accessControl;
    constructor(prisma: PrismaService, accessControl: AccessControlService);
    findAll(query: TaskAssignmentQueryDto, user: AuthUser): Promise<{
        items: ({
            task: {
                project: {
                    deletedAt: Date | null;
                    id: number;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    departmentId: number;
                    managerId: number;
                    startDate: Date | null;
                    endDate: Date | null;
                    status: import(".prisma/client").$Enums.ProjectStatus;
                    description: string | null;
                    createdByUserId: number | null;
                } | null;
                assignee: ({
                    department: {
                        deletedAt: Date | null;
                        id: number;
                        isActive: boolean;
                        createdAt: Date;
                        updatedAt: Date;
                        name: string;
                        code: string;
                        managerId: number | null;
                        parentId: number | null;
                    } | null;
                    position: {
                        deletedAt: Date | null;
                        id: number;
                        isActive: boolean;
                        createdAt: Date;
                        updatedAt: Date;
                        name: string;
                        code: string;
                        departmentId: number | null;
                    } | null;
                } & {
                    deletedAt: Date | null;
                    id: number;
                    createdAt: Date;
                    updatedAt: Date;
                    userId: number | null;
                    departmentId: number | null;
                    employeeCode: string;
                    fullName: string;
                    companyEmail: string;
                    avatarUrl: string | null;
                    personalEmail: string | null;
                    phone: string | null;
                    birthDate: Date;
                    hireDate: Date | null;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    positionId: number | null;
                    careerLevel: import(".prisma/client").$Enums.CareerLevel;
                }) | null;
            } & {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                departmentId: number | null;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                description: string | null;
                createdByUserId: number | null;
                parentTaskId: number | null;
                projectId: number | null;
                title: string;
                technologies: string[];
                priority: import(".prisma/client").$Enums.TaskPriority;
                assigneeId: number | null;
                assignedByUserId: number | null;
                dueDate: Date | null;
                estimatedHours: Prisma.Decimal | null;
                actualHours: Prisma.Decimal | null;
                completedAt: Date | null;
            };
            assignee: {
                department: {
                    deletedAt: Date | null;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    managerId: number | null;
                    parentId: number | null;
                } | null;
                position: {
                    deletedAt: Date | null;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    departmentId: number | null;
                } | null;
            } & {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                userId: number | null;
                departmentId: number | null;
                employeeCode: string;
                fullName: string;
                companyEmail: string;
                avatarUrl: string | null;
                personalEmail: string | null;
                phone: string | null;
                birthDate: Date;
                hireDate: Date | null;
                status: import(".prisma/client").$Enums.EmployeeStatus;
                positionId: number | null;
                careerLevel: import(".prisma/client").$Enums.CareerLevel;
            };
            assignedByUser: {
                id: number;
                username: string;
                email: string;
            };
        } & {
            id: number;
            assigneeId: number;
            assignedByUserId: number;
            taskId: number;
            note: string | null;
            assignmentType: import(".prisma/client").$Enums.TaskAssignmentType;
            assignedAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    private buildWhere;
}
