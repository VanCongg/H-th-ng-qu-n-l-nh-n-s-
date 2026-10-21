import type { ReactNode } from "react";
import { useAuthStore } from "../../store/auth";
import type { RoleName } from "../../api/types";

type PermissionGateProps = {
  roles?: RoleName[];
  permissions?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({
  roles,
  permissions,
  children,
  fallback = null
}: PermissionGateProps) {
  const hasRole = useAuthStore((state) => state.hasRole);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (roles?.length && !hasRole(roles)) {
    return fallback;
  }

  if (permissions?.length && !hasPermission(permissions)) {
    return fallback;
  }

  return children;
}
