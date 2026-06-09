import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  FileClock,
  FileText,
  ListChecks,
  LockKeyhole,
  Network,
  Settings,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "../i18n";

export type NavItem = {
  labelKey: TranslationKey;
  to: string;
  icon: LucideIcon;
};

export const appNavItems: NavItem[] = [
  { labelKey: "dashboard", to: "/app/dashboard", icon: BarChart3 },
  { labelKey: "myTeam", to: "/app/team", icon: Users },
  { labelKey: "teamAttendance", to: "/app/team-attendance", icon: Activity },
  {
    labelKey: "teamLeaveRequests",
    to: "/app/team-leave-requests",
    icon: ClipboardList
  },
  { labelKey: "myProfile", to: "/app/profile", icon: UserRound }
];

export const adminNavItems: NavItem[] = [
  { labelKey: "dashboard", to: "/admin/dashboard", icon: BarChart3 },
  { labelKey: "employees", to: "/admin/employees", icon: Users },
  { labelKey: "departments", to: "/admin/departments", icon: Building2 },
  { labelKey: "positions", to: "/admin/positions", icon: BadgeCheck },
  { labelKey: "managers", to: "/admin/managers", icon: Network },
  { labelKey: "attendance", to: "/admin/attendance", icon: CalendarDays },
  {
    labelKey: "leaveRequests",
    to: "/admin/leave-requests",
    icon: ClipboardList
  },
  { labelKey: "leaveTypes", to: "/admin/leave-types", icon: ListChecks },
  { labelKey: "users", to: "/admin/users", icon: UserRound },
  {
    labelKey: "rolesPermissions",
    to: "/admin/roles-permissions",
    icon: ShieldCheck
  },
  { labelKey: "auditLogs", to: "/admin/audit-logs", icon: FileClock },
  { labelKey: "policies", to: "/admin/policies", icon: FileText },
  { labelKey: "systemSettings", to: "/admin/system-settings", icon: Settings }
];

export const adminEntry: NavItem = {
  labelKey: "systemAdmin",
  to: "/admin/dashboard",
  icon: LockKeyhole
};
