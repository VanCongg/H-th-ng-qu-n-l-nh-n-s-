import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PermissionGate } from "./PermissionGate";
import { authStore } from "../../store/auth";
import type { AuthUser } from "../../api/types";

function signIn(overrides: Partial<AuthUser> = {}) {
  authStore.setState({
    hydrated: true,
    accessToken: "token",
    refreshToken: "refresh",
    user: {
      id: 1,
      username: "user",
      email: "user@omnihr.dev",
      roles: ["EMPLOYEE"],
      permissions: [],
      employeeId: 1,
      mustChangePassword: false,
      ...overrides
    }
  });
}

describe("PermissionGate", () => {
  beforeEach(() => {
    authStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: false });
  });

  it("renders children when no roles/permissions are required", () => {
    render(<PermissionGate>secret content</PermissionGate>);
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("hides children and renders the fallback when the role does not match", () => {
    signIn({ roles: ["EMPLOYEE"] });
    render(
      <PermissionGate roles={["ADMIN"]} fallback={<span>forbidden</span>}>
        secret content
      </PermissionGate>
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(screen.getByText("forbidden")).toBeInTheDocument();
  });

  it("renders children when the required role matches", () => {
    signIn({ roles: ["ADMIN"] });
    render(<PermissionGate roles={["ADMIN"]}>secret content</PermissionGate>);
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("hides children when a required permission is missing", () => {
    signIn({ roles: ["MANAGER"], permissions: ["team.view"] });
    render(
      <PermissionGate permissions={["user.delete"]} fallback={<span>forbidden</span>}>
        secret content
      </PermissionGate>
    );
    expect(screen.getByText("forbidden")).toBeInTheDocument();
  });
});
