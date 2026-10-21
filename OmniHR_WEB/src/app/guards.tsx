// Các guard điều hướng phía client (chỉ để trải nghiệm; backend vẫn kiểm tra quyền thật).

import { Center, Loader } from "@mantine/core";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { RoleName } from "../api/types";
import { useAuthStore } from "../store/auth";
import { usePreferencesStore } from "../store/preferences";

// Đọc lại phiên đăng nhập từ localStorage khi tải trang.
export function AuthHydrator() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
    hydratePreferences();
  }, [hydrate, hydratePreferences]);

  return <Outlet />;
}

// Đang đọc phiên thì hiện loader; chưa đăng nhập thì chuyển về /login (nhớ trang đang mở để quay lại).
export function RequireAuth() {
  const location = useLocation();
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!hydrated) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

// Thiếu role yêu cầu thì chuyển về trang báo không có quyền.
export function RequireRole({ roles }: { roles: RoleName[] }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.roles.some((role) => roles.includes(role))) {
    if (isEmployeeOnly(user.roles)) {
      return <Navigate to="/employee-web-notice" replace />;
    }
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}

// Vào "/" thì chuyển theo role: ADMIN -> /admin/dashboard, MANAGER -> /app/dashboard.
export function RootRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.roles.includes("ADMIN")) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user.roles.includes("MANAGER")) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Navigate to="/employee-web-notice" replace />;
}

// Thiếu permission yêu cầu thì chặn.
export function RequirePermission({ permissions }: { permissions: string[] }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!hasPermission(permissions)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}

/** Admins land on the dashboard; accountants only have the attendance area. */
export function AdminIndexRedirect() {
  const user = useAuthStore((state) => state.user);

  return (
    <Navigate
      to={user?.roles.includes("ADMIN") ? "/admin/dashboard" : "/admin/attendance"}
      replace
    />
  );
}

function isEmployeeOnly(roles: RoleName[]) {
  return (
    roles.includes("EMPLOYEE") &&
    !roles.includes("ADMIN") &&
    !roles.includes("MANAGER")
  );
}
