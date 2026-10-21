import { create } from "zustand";
import type { AuthUser, LoginResponse, RoleName } from "../api/types";

const ACCESS_TOKEN_KEY = "omnihr_access_token";
const REFRESH_TOKEN_KEY = "omnihr_refresh_token";
const USER_KEY = "omnihr_user";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (session: LoginResponse) => void;
  setUser: (user: AuthUser | null) => void;
  logoutLocal: () => void;
  hydrate: () => void;
  hasRole: (roles: RoleName | RoleName[]) => boolean;
  hasPermission: (permissions: string | string[]) => boolean;
};

export const authStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  setSession: (session) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    set({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      hydrated: true
    });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },

  logoutLocal: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true
    });
  },

  hydrate: () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    let user: AuthUser | null = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw) as AuthUser;
      } catch {
        user = null;
      }
    }
    set({ accessToken, refreshToken, user, hydrated: true });
  },

  hasRole: (roles) => {
    const required = Array.isArray(roles) ? roles : [roles];
    const user = get().user;
    return Boolean(user?.roles.some((role) => required.includes(role)));
  },

  hasPermission: (permissions) => {
    const required = Array.isArray(permissions) ? permissions : [permissions];
    const user = get().user;
    if (user?.roles.includes("ADMIN")) {
      return true;
    }
    return Boolean(user?.permissions.some((permission) => required.includes(permission)));
  }
}));

export const useAuthStore = authStore;
