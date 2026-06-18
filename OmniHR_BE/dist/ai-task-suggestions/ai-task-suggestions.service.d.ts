import { Prisma } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { TaskWorkloadService } from "../task-workload/task-workload.service";
import { AiTaskSuggestionQueryDto } from "./dto/ai-task-suggestion-query.dto";
import { GenerateAiTaskSuggestionDto } from "./dto/generate-ai-task-suggestion.dto";
import { SelectAiTaskSuggestionDto } from "./dto/select-ai-task-suggestion.dto";
export declare class AiTaskSuggestionsService {
    private readonly prisma;
    private readonly audit;
    private readonly accessControl;
    private readonly workloadService;
    constructor(prisma: PrismaService, audit: AuditService, accessControl: AccessControlService, workloadService: TaskWorkloadService);
    generate(taskId: number, dto: GenerateAiTaskSuggestionDto, actor: AuthUser, context?: RequestContext): Promise<{
        suggestionId: number;
        id: number;
        taskId: number;
        task: {
            project: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
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
            requiredSkills: ({
                skill: {
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    description: string | null;
                    category: string | null;
                };
            } & {
                id: number;
                createdAt: Date;
                taskId: number;
                skillId: number;
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency | null;
                weight: Prisma.Decimal;
                isRequired: boolean;
            })[];
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
            projectId: number | null;
            title: string;
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: Prisma.Decimal | null;
            actualHours: Prisma.Decimal | null;
            completedAt: Date | null;
        };
        requestedByUser: {
            id: number;
            username: string;
            email: string;
        };
        algorithmVersion: string;
        status: import(".prisma/client").$Enums.AiTaskSuggestionStatus;
        createdAt: Date;
        items: {
            suggestionItemId: number;
            id: number;
            employeeId: number;
            employee: {
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
            fullName: string;
            rank: number;
            score: number;
            skillScore: number;
            workloadScore: number;
            availabilityScore: number;
            performanceScore: number | null;
            reason: string | null;
            selected: boolean;
        }[];
    }>;
    findAll(query: AiTaskSuggestionQueryDto, user: AuthUser): Promise<{
        items: {
            suggestionId: number;
            id: number;
            taskId: number;
            task: {
                project: {
                    deletedAt: Date | null;
                    id: number;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    departmentId: number | null;
                    managerId: number | null;
                    startDate: Date | null;
                    endDate: Date | null;
                    status: import(".prisma/client").$Enums.ProjectStatus;
                    teamId: number | null;
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
                requiredSkills: ({
                    skill: {
                        id: number;
                        isActive: boolean;
                        createdAt: Date;
                        updatedAt: Date;
                        name: string;
                        code: string;
                        description: string | null;
                        category: string | null;
                    };
                } & {
                    id: number;
                    createdAt: Date;
                    taskId: number;
                    skillId: number;
                    requiredProficiency: import(".prisma/client").$Enums.SkillProficiency | null;
                    weight: Prisma.Decimal;
                    isRequired: boolean;
                })[];
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
                projectId: number | null;
                title: string;
                priority: import(".prisma/client").$Enums.TaskPriority;
                assigneeId: number | null;
                assignedByUserId: number | null;
                dueDate: Date | null;
                estimatedHours: Prisma.Decimal | null;
                actualHours: Prisma.Decimal | null;
                completedAt: Date | null;
            };
            requestedByUser: {
                id: number;
                username: string;
                email: string;
            };
            algorithmVersion: string;
            status: import(".prisma/client").$Enums.AiTaskSuggestionStatus;
            createdAt: Date;
            items: {
                suggestionItemId: number;
                id: number;
                employeeId: number;
                employee: {
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
                fullName: string;
                rank: number;
                score: number;
                skillScore: number;
                workloadScore: number;
                availabilityScore: number;
                performanceScore: number | null;
                reason: string | null;
                selected: boolean;
            }[];
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findByTask(taskId: number, user: AuthUser): Promise<{
        suggestionId: number;
        id: number;
        taskId: number;
        task: {
            project: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
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
            requiredSkills: ({
                skill: {
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    description: string | null;
                    category: string | null;
                };
            } & {
                id: number;
                createdAt: Date;
                taskId: number;
                skillId: number;
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency | null;
                weight: Prisma.Decimal;
                isRequired: boolean;
            })[];
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
            projectId: number | null;
            title: string;
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: Prisma.Decimal | null;
            actualHours: Prisma.Decimal | null;
            completedAt: Date | null;
        };
        requestedByUser: {
            id: number;
            username: string;
            email: string;
        };
        algorithmVersion: string;
        status: import(".prisma/client").$Enums.AiTaskSuggestionStatus;
        createdAt: Date;
        items: {
            suggestionItemId: number;
            id: number;
            employeeId: number;
            employee: {
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
            fullName: string;
            rank: number;
            score: number;
            skillScore: number;
            workloadScore: number;
            availabilityScore: number;
            performanceScore: number | null;
            reason: string | null;
            selected: boolean;
        }[];
    }[]>;
    findOne(id: number, user: AuthUser): Promise<{
        suggestionId: number;
        id: number;
        taskId: number;
        task: {
            project: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
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
            requiredSkills: ({
                skill: {
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    description: string | null;
                    category: string | null;
                };
            } & {
                id: number;
                createdAt: Date;
                taskId: number;
                skillId: number;
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency | null;
                weight: Prisma.Decimal;
                isRequired: boolean;
            })[];
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
            projectId: number | null;
            title: string;
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: Prisma.Decimal | null;
            actualHours: Prisma.Decimal | null;
            completedAt: Date | null;
        };
        requestedByUser: {
            id: number;
            username: string;
            email: string;
        };
        algorithmVersion: string;
        status: import(".prisma/client").$Enums.AiTaskSuggestionStatus;
        createdAt: Date;
        items: {
            suggestionItemId: number;
            id: number;
            employeeId: number;
            employee: {
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
            fullName: string;
            rank: number;
            score: number;
            skillScore: number;
            workloadScore: number;
            availabilityScore: number;
            performanceScore: number | null;
            reason: string | null;
            selected: boolean;
        }[];
    }>;
    select(id: number, dto: SelectAiTaskSuggestionDto, actor: AuthUser, context?: RequestContext): Promise<{
        suggestionId: number;
        id: number;
        taskId: number;
        task: {
            project: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
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
            requiredSkills: ({
                skill: {
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    name: string;
                    code: string;
                    description: string | null;
                    category: string | null;
                };
            } & {
                id: number;
                createdAt: Date;
                taskId: number;
                skillId: number;
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency | null;
                weight: Prisma.Decimal;
                isRequired: boolean;
            })[];
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
            projectId: number | null;
            title: string;
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: Prisma.Decimal | null;
            actualHours: Prisma.Decimal | null;
            completedAt: Date | null;
        };
        requestedByUser: {
            id: number;
            username: string;
            email: string;
        };
        algorithmVersion: string;
        status: import(".prisma/client").$Enums.AiTaskSuggestionStatus;
        createdAt: Date;
        items: {
            suggestionItemId: number;
            id: number;
            employeeId: number;
            employee: {
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
            fullName: string;
            rank: number;
            score: number;
            skillScore: number;
            workloadScore: number;
            availabilityScore: number;
            performanceScore: number | null;
            reason: string | null;
            selected: boolean;
        }[];
    }>;
    private buildWhere;
    private present;
    private skillScore;
    private proficiencyScore;
    private experienceBonus;
    private availabilityScore;
    private reason;
    private emptyWorkload;
    private round;
}
