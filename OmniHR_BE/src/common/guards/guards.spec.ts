import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthUser } from "../types";
import { PermissionsGuard } from "./permissions.guard";
import { RolesGuard } from "./roles.guard";

function contextWithUser(user?: Partial<AuthUser>) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

function reflectorReturning(value: string[] | undefined) {
  return { getAllAndOverride: jest.fn().mockReturnValue(value) } as unknown as Reflector;
}

describe("PermissionsGuard", () => {
  it("lets a route through when it declares no permissions", () => {
    const guard = new PermissionsGuard(reflectorReturning(undefined));

    expect(guard.canActivate(contextWithUser())).toBe(true);
  });

  it("rejects an unauthenticated request on a guarded route", () => {
    const guard = new PermissionsGuard(reflectorReturning(["LEAVE_READ_ALL"]));

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      expect.objectContaining({ errorCode: "UNAUTHORIZED" })
    );
  });

  it("rejects a user missing the permission", () => {
    const guard = new PermissionsGuard(reflectorReturning(["LEAVE_READ_ALL"]));

    expect(() =>
      guard.canActivate(contextWithUser({ permissions: ["LEAVE_READ_SELF"] }))
    ).toThrow(expect.objectContaining({ errorCode: "FORBIDDEN" }));
  });

  it("treats several declared permissions as OR, not AND", () => {
    // Routes such as GET /attendance/timesheets rely on this: holding any one of the
    // listed permissions is enough.
    const guard = new PermissionsGuard(
      reflectorReturning(["ATTENDANCE_READ_ALL", "ATTENDANCE_READ_TEAM"])
    );

    expect(guard.canActivate(contextWithUser({ permissions: ["ATTENDANCE_READ_TEAM"] }))).toBe(
      true
    );
  });

  it("does not infer permissions from the ADMIN role", () => {
    // The backend guard checks granted permissions only - unlike the web
    // client's hasPermission, which short-circuits for ADMIN.
    const guard = new PermissionsGuard(reflectorReturning(["ATTENDANCE_READ_ALL"]));

    expect(() =>
      guard.canActivate(contextWithUser({ roles: ["ADMIN"], permissions: [] }))
    ).toThrow(expect.objectContaining({ errorCode: "FORBIDDEN" }));
  });
});

describe("RolesGuard", () => {
  it("lets a route through when it declares no roles", () => {
    const guard = new RolesGuard(reflectorReturning(undefined));

    expect(guard.canActivate(contextWithUser())).toBe(true);
  });

  it("rejects an unauthenticated request on a role-guarded route", () => {
    const guard = new RolesGuard(reflectorReturning(["ADMIN"]));

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      expect.objectContaining({ errorCode: "UNAUTHORIZED" })
    );
  });

  it("rejects a user without the role", () => {
    const guard = new RolesGuard(reflectorReturning(["ADMIN"]));

    expect(() => guard.canActivate(contextWithUser({ roles: ["MANAGER"] }))).toThrow(
      expect.objectContaining({ errorCode: "FORBIDDEN" })
    );
  });

  it("accepts a user holding any one of the declared roles", () => {
    const guard = new RolesGuard(reflectorReturning(["ADMIN", "MANAGER"]));

    expect(guard.canActivate(contextWithUser({ roles: ["MANAGER"] }))).toBe(true);
  });
});
