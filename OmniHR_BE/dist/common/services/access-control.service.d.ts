import { PrismaService } from "../../prisma/prisma.service";
import { AuthUser } from "../types";
export declare class AccessControlService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    isAdmin(user: AuthUser): boolean;
    isManager(user: AuthUser): boolean;
    ensureCanReadEmployee(user: AuthUser, employeeId: number): Promise<void>;
    ensureCanManageLeave(user: AuthUser, employeeId: number): Promise<void>;
    teamEmployeeIds(user: AuthUser): Promise<number[]>;
    managedTeamIds(user: AuthUser): Promise<number[]>;
    isDepartmentHead(user: AuthUser, departmentId: number): Promise<boolean>;
    isTeamLead(user: AuthUser, teamId: number): Promise<boolean>;
    isSubordinate(user: AuthUser, employeeId: number): Promise<boolean>;
    ensureCanReadProject(user: AuthUser, projectId: number): Promise<void>;
    ensureCanReadTask(user: AuthUser, taskId: number): Promise<{
        team: {
            leadId: number | null;
            members: {
                employeeId: number;
            }[];
        } | null;
        project: {
            departmentId: number;
        } | null;
        departmentId: number | null;
        teamId: number | null;
        createdByUserId: number | null;
        parentTaskId: number | null;
        projectId: number | null;
        assigneeId: number | null;
    }>;
    ensureCanUpdateTask(user: AuthUser, taskId: number): Promise<{
        team: {
            leadId: number | null;
            members: {
                employeeId: number;
            }[];
        } | null;
        project: {
            departmentId: number;
        } | null;
        departmentId: number | null;
        teamId: number | null;
        createdByUserId: number | null;
        parentTaskId: number | null;
        projectId: number | null;
        assigneeId: number | null;
    }>;
    ensureCanUpdateTaskStatus(user: AuthUser, taskId: number): Promise<{
        team: {
            leadId: number | null;
            members: {
                employeeId: number;
            }[];
        } | null;
        project: {
            departmentId: number;
        } | null;
        departmentId: number | null;
        teamId: number | null;
        createdByUserId: number | null;
        parentTaskId: number | null;
        projectId: number | null;
        assigneeId: number | null;
    }>;
    ensureCanAssignToEmployee(user: AuthUser, employeeId: number): Promise<void>;
    ensureCanAssignTask(user: AuthUser, taskId: number, employeeId: number): Promise<void>;
    candidateEmployeeIdsForTask(user: AuthUser): Promise<number[]>;
    ensureCanGenerateTaskSuggestion(user: AuthUser, taskId: number): Promise<void>;
    ensureCanReadEmployeeSkill(user: AuthUser, employeeId: number): Promise<void>;
    ensureCanUpdateEmployeeSkill(user: AuthUser, employeeId: number): Promise<void>;
}
