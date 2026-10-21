import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "./auth";
import type { AuthUser, LoginResponse } from "../api/types";

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    username: "manager1",
    email: "manager1@omnihr.dev",
    roles: ["MANAGER"],
    permissions: ["team.view", "leave.approve"],
    employeeId: 10,
    mustChangePassword: false,
    ...overrides
  };
}

function buildSession(overrides: Partial<AuthUser> = {}): LoginResponse {
  return {
    user: buildUser(overrides),
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenType: "Bearer"
  };
}

describe("authStore", () => {
  beforeEach(() => {
    authStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: false });
    window.localStorage.clear();
  });

  it("setSession stores tokens/user in state and localStorage", () => {
    authStore.getState().setSession(buildSession());

    const state = authStore.getState();
    expect(state.accessToken).toBe("access-token");
    expect(state.refreshToken).toBe("refresh-token");
    expect(state.user?.username).toBe("manager1");
    expect(state.hydrated).toBe(true);
    expect(window.localStorage.getItem("omnihr_access_token")).toBe("access-token");
  });

  it("logoutLocal clears state and localStorage", () => {
    authStore.getState().setSession(buildSession());
    authStore.getState().logoutLocal();

    const state = authStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(window.localStorage.getItem("omnihr_access_token")).toBeNull();
  });

  it("hydrate restores session from localStorage", () => {
    authStore.getState().setSession(buildSession());
    authStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: false });

    authStore.getState().hydrate();

    const state = authStore.getState();
    expect(state.accessToken).toBe("access-token");
    expect(state.user?.username).toBe("manager1");
  });

  it("hydrate tolerates corrupted user JSON in localStorage", () => {
    window.localStorage.setItem("omnihr_access_token", "access-token");
    window.localStorage.setItem("omnihr_user", "{not-json");

    authStore.getState().hydrate();

    expect(authStore.getState().user).toBeNull();
    expect(authStore.getState().accessToken).toBe("access-token");
  });

  describe("hasRole", () => {
    it("returns false when there is no user", () => {
      expect(authStore.getState().hasRole("ADMIN")).toBe(false);
    });

    it("matches a single role or any role in a list", () => {
      authStore.getState().setSession(buildSession({ roles: ["MANAGER"] }));
      expect(authStore.getState().hasRole("MANAGER")).toBe(true);
      expect(authStore.getState().hasRole(["ADMIN", "MANAGER"])).toBe(true);
      expect(authStore.getState().hasRole("ADMIN")).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("ADMIN role bypasses explicit permission checks", () => {
      authStore.getState().setSession(buildSession({ roles: ["ADMIN"], permissions: [] }));
      expect(authStore.getState().hasPermission("anything.at.all")).toBe(true);
    });

    it("non-admin users need the permission explicitly", () => {
      authStore
        .getState()
        .setSession(buildSession({ roles: ["MANAGER"], permissions: ["leave.approve"] }));
      expect(authStore.getState().hasPermission("leave.approve")).toBe(true);
      expect(authStore.getState().hasPermission("user.delete")).toBe(false);
      expect(authStore.getState().hasPermission(["user.delete", "leave.approve"])).toBe(true);
    });
  });
});
