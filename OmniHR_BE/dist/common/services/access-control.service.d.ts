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
    isSubordinate(user: AuthUser, employeeId: number): Promise<boolean>;
}
