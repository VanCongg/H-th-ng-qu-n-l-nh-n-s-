import { Prisma } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
export declare const taskInclude: {
    project: true;
    department: true;
    team: {
        include: {
            department: true;
            lead: {
                include: {
                    department: true;
                    position: true;
                };
            };
            members: {
                where: {
                    isActive: true;
                };
                include: {
                    employee: {
                        include: {
                            department: true;
                            position: true;
                        };
                    };
                };
            };
        };
    };
    assignee: {
        include: {
            department: true;
            position: true;
        };
    };
    createdByUser: {
        select: {
            id: true;
            username: true;
            email: true;
        };
    };
    assignedByUser: {
        select: {
            id: true;
            username: true;
            email: true;
        };
    };
    requiredSkills: {
        include: {
            skill: true;
        };
    };
    _count: {
        select: {
            assignments: true;
            aiTaskSuggestions: true;
        };
    };
};
export declare class TasksService {
    private readonly prisma;
    private readonly audit;
    private readonly accessControl;
    constructor(prisma: PrismaService, audit: AuditService, accessControl: AccessControlService);
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
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
                description: string | null;
                createdByUserId: number | null;
            } | null;
            _count: {
                aiTaskSuggestions: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
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
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
                description: string | null;
                createdByUserId: number | null;
            } | null;
            _count: {
                aiTaskSuggestions: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
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
                departmentId: number | null;
                managerId: number | null;
                startDate: Date | null;
                endDate: Date | null;
                status: import(".prisma/client").$Enums.ProjectStatus;
                teamId: number | null;
                description: string | null;
                createdByUserId: number | null;
            } | null;
            _count: {
                aiTaskSuggestions: number;
                assignments: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    create(dto: CreateTaskDto, actor: AuthUser, context?: RequestContext): Promise<{
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    update(id: number, dto: UpdateTaskDto, actor: AuthUser, context?: RequestContext): Promise<{
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    assign(id: number, dto: AssignTaskDto, actor: AuthUser, context?: RequestContext, assignmentType?: "MANUAL"): Promise<{
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    updateStatus(id: number, dto: UpdateTaskStatusDto, actor: AuthUser, context?: RequestContext): Promise<{
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<{
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
            departmentId: number | null;
            managerId: number | null;
            startDate: Date | null;
            endDate: Date | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            teamId: number | null;
            description: string | null;
            createdByUserId: number | null;
        } | null;
        _count: {
            aiTaskSuggestions: number;
            assignments: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
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
    }>;
    private paginatedList;
    private buildWhere;
    private resolveTaskScope;
    private ensureAssigneeInTaskTeam;
    private ensureRequiredSkills;
    private ensureDateRange;
    private requiredSkillsCreate;
    private requiredSkillsData;
}
