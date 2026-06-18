import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
export declare class ProjectsService {
    private readonly prisma;
    private readonly audit;
    private readonly accessControl;
    constructor(prisma: PrismaService, audit: AuditService, accessControl: AccessControlService);
    findAll(query: ProjectQueryDto, user: AuthUser): Promise<{
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
            manager: ({
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
            _count: {
                tasks: number;
            };
            createdByUser: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
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
        manager: ({
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
        _count: {
            tasks: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
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
    }>;
    create(dto: CreateProjectDto, actor: AuthUser, context?: RequestContext): Promise<{
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
        manager: ({
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
        _count: {
            tasks: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
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
    }>;
    update(id: number, dto: UpdateProjectDto, actor: AuthUser, context?: RequestContext): Promise<{
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
        manager: ({
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
        _count: {
            tasks: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
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
        manager: ({
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
        _count: {
            tasks: number;
        };
        createdByUser: {
            id: number;
            username: string;
            email: string;
        } | null;
    } & {
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
    }>;
    private buildWhere;
    private resolveProjectScope;
    private ensureReferences;
    private ensureDateRange;
    private defaultProjectManagerId;
    private ensureCanUseProjectManager;
}
