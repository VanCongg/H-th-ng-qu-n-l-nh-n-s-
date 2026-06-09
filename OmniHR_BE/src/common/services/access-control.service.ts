import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiError } from "../api-error";
import { AuthUser } from "../types";
import { toDateOnly } from "../utils";

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser) {
    return user.roles.includes("ADMIN");
  }

  isManager(user: AuthUser) {
    return user.roles.includes("MANAGER");
  }

  async ensureCanReadEmployee(user: AuthUser, employeeId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      return;
    }

    if (await this.isSubordinate(user, employeeId)) {
      return;
    }

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Manager scope denied",
      "MANAGER_SCOPE_DENIED"
    );
  }

  async ensureCanManageLeave(user: AuthUser, employeeId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "You cannot approve or reject your own leave request",
        "MANAGER_SCOPE_DENIED"
      );
    }

    if (!(await this.isSubordinate(user, employeeId))) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Manager scope denied",
        "MANAGER_SCOPE_DENIED"
      );
    }
  }

  async teamEmployeeIds(user: AuthUser): Promise<number[]> {
    if (!user.employeeId) {
      return [];
    }

    const today = toDateOnly(new Date());
    const rows = await this.prisma.employeeManager.findMany({
      where: {
        managerId: user.employeeId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      select: { employeeId: true }
    });

    return rows.map((row) => row.employeeId);
  }

  async isSubordinate(user: AuthUser, employeeId: number): Promise<boolean> {
    if (!user.employeeId) {
      return false;
    }

    const today = toDateOnly(new Date());
    const relation = await this.prisma.employeeManager.findFirst({
      where: {
        employeeId,
        managerId: user.employeeId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      select: { id: true }
    });

    return Boolean(relation);
  }
}
