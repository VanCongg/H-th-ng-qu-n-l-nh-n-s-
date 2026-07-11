import { AuthUser, RequestContext } from "../common/types";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { TasksService } from "./tasks.service";
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    findAll(query: TaskQueryDto, user: AuthUser): Promise<{
        items: ({
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
            team: ({
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
                };
                lead: ({
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
                members: ({
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
                } & {
                    role: import(".prisma/client").$Enums.TeamMemberRole;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    employeeId: number;
                    teamId: number;
                    joinedAt: Date;
                    leftAt: Date | null;
                })[];
            } & {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number;
                leadId: number | null;
                description: string | null;
            }) | null;
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
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            parentTask: {
                id: number;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                title: string;
                dueDate: Date | null;
            } | null;
            childTasks: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                departmentId: number | null;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                description: string | null;
                _count: {
                    aiTaskSuggestions: number;
                    childTasks: number;
                    assignments: number;
                };
                createdByUserId: number | null;
                parentTaskId: number | null;
                projectId: number | null;
                title: string;
                technologies: string[];
                priority: import(".prisma/client").$Enums.TaskPriority;
                assigneeId: number | null;
                assignedByUserId: number | null;
                dueDate: Date | null;
                estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
                actualHours: import("@prisma/client/runtime/library").Decimal | null;
                completedAt: Date | null;
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
                    requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                    importance: import(".prisma/client").$Enums.TaskSkillImportance;
                })[];
            }[];
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
            assignedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findTeam(query: TaskQueryDto, user: AuthUser): Promise<{
        items: ({
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
            team: ({
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
                };
                lead: ({
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
                members: ({
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
                } & {
                    role: import(".prisma/client").$Enums.TeamMemberRole;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    employeeId: number;
                    teamId: number;
                    joinedAt: Date;
                    leftAt: Date | null;
                })[];
            } & {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number;
                leadId: number | null;
                description: string | null;
            }) | null;
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
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            parentTask: {
                id: number;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                title: string;
                dueDate: Date | null;
            } | null;
            childTasks: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                departmentId: number | null;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                description: string | null;
                _count: {
                    aiTaskSuggestions: number;
                    childTasks: number;
                    assignments: number;
                };
                createdByUserId: number | null;
                parentTaskId: number | null;
                projectId: number | null;
                title: string;
                technologies: string[];
                priority: import(".prisma/client").$Enums.TaskPriority;
                assigneeId: number | null;
                assignedByUserId: number | null;
                dueDate: Date | null;
                estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
                actualHours: import("@prisma/client/runtime/library").Decimal | null;
                completedAt: Date | null;
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
                    requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                    importance: import(".prisma/client").$Enums.TaskSkillImportance;
                })[];
            }[];
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
            assignedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findSelf(query: TaskQueryDto, user: AuthUser): Promise<{
        items: ({
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
            team: ({
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
                };
                lead: ({
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
                members: ({
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
                } & {
                    role: import(".prisma/client").$Enums.TeamMemberRole;
                    id: number;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    employeeId: number;
                    teamId: number;
                    joinedAt: Date;
                    leftAt: Date | null;
                })[];
            } & {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number;
                leadId: number | null;
                description: string | null;
            }) | null;
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
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
            parentTask: {
                id: number;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                title: string;
                dueDate: Date | null;
            } | null;
            childTasks: {
                deletedAt: Date | null;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                departmentId: number | null;
                startDate: Date | null;
                status: import(".prisma/client").$Enums.TaskStatus;
                teamId: number | null;
                description: string | null;
                _count: {
                    aiTaskSuggestions: number;
                    childTasks: number;
                    assignments: number;
                };
                createdByUserId: number | null;
                parentTaskId: number | null;
                projectId: number | null;
                title: string;
                technologies: string[];
                priority: import(".prisma/client").$Enums.TaskPriority;
                assigneeId: number | null;
                assignedByUserId: number | null;
                dueDate: Date | null;
                estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
                actualHours: import("@prisma/client/runtime/library").Decimal | null;
                completedAt: Date | null;
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
                    requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                    importance: import(".prisma/client").$Enums.TaskSkillImportance;
                })[];
            }[];
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
            assignedByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
    findOne(id: number, user: AuthUser): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
    create(dto: CreateTaskDto, user: AuthUser, context: RequestContext): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
    update(id: number, dto: UpdateTaskDto, user: AuthUser, context: RequestContext): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
    assign(id: number, dto: AssignTaskDto, user: AuthUser, context: RequestContext): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
    updateStatus(id: number, dto: UpdateTaskStatusDto, user: AuthUser, context: RequestContext): Promise<{
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
        team: ({
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
            };
            lead: ({
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
            members: ({
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
            } & {
                role: import(".prisma/client").$Enums.TeamMemberRole;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                employeeId: number;
                teamId: number;
                joinedAt: Date;
                leftAt: Date | null;
            })[];
        } & {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            departmentId: number;
            leadId: number | null;
            description: string | null;
        }) | null;
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
        _count: {
            aiTaskSuggestions: number;
            childTasks: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
        parentTask: {
            id: number;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            title: string;
            dueDate: Date | null;
        } | null;
        childTasks: {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            departmentId: number | null;
            startDate: Date | null;
            status: import(".prisma/client").$Enums.TaskStatus;
            teamId: number | null;
            description: string | null;
            _count: {
                aiTaskSuggestions: number;
                childTasks: number;
                assignments: number;
            };
            createdByUserId: number | null;
            parentTaskId: number | null;
            projectId: number | null;
            title: string;
            technologies: string[];
            priority: import(".prisma/client").$Enums.TaskPriority;
            assigneeId: number | null;
            assignedByUserId: number | null;
            dueDate: Date | null;
            estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
            actualHours: import("@prisma/client/runtime/library").Decimal | null;
            completedAt: Date | null;
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
                requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
                importance: import(".prisma/client").$Enums.TaskSkillImportance;
            })[];
        }[];
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
        assignedByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
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
            requiredProficiency: import(".prisma/client").$Enums.SkillProficiency;
            importance: import(".prisma/client").$Enums.TaskSkillImportance;
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
        parentTaskId: number | null;
        projectId: number | null;
        title: string;
        technologies: string[];
        priority: import(".prisma/client").$Enums.TaskPriority;
        assigneeId: number | null;
        assignedByUserId: number | null;
        dueDate: Date | null;
        estimatedHours: import("@prisma/client/runtime/library").Decimal | null;
        actualHours: import("@prisma/client/runtime/library").Decimal | null;
        completedAt: Date | null;
    }>;
}
