import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  FileClock,
  FileText,
  Network,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleName } from "../api/types";
import type { TranslationKey } from "../i18n";

export type NavItem = {
  labelKey: TranslationKey;
  to: string;
  icon: LucideIcon;
  /** Shown only to users with one of these roles. */
  roles?: RoleName[];
  /** Shown only to users with one of these permissions. */
  permissions?: string[];
};

export const appNavItems: NavItem[] = [
  { labelKey: "dashboard", to: "/app/dashboard", icon: BarChart3 },
  { labelKey: "myTeam", to: "/app/team", icon: Users },
  { labelKey: "teams", to: "/app/teams", icon: Network },
  { labelKey: "employeeSkills", to: "/app/employee-skills", icon: Sparkles },
  { labelKey: "teamAttendance", to: "/app/team-attendance", icon: Activity },
  {
    labelKey: "teamLeaveRequests",
    to: "/app/team-leave-requests",
    icon: ClipboardList
  },
  { labelKey: "projects", to: "/app/projects", icon: ClipboardList },
  { labelKey: "teamTasks", to: "/app/team-tasks", icon: CheckSquare },
  { labelKey: "myProfile", to: "/app/profile", icon: UserRound }
];

const adminOnly: RoleName[] = ["ADMIN"];

export const adminNavItems: NavItem[] = [
  { labelKey: "dashboard", to: "/admin/dashboard", icon: BarChart3, roles: adminOnly },
  {
    labelKey: "attendance",
    to: "/admin/attendance",
    icon: Clock,
    permissions: ["ATTENDANCE_READ_ALL"]
  },
  {
    labelKey: "timesheets",
    to: "/admin/timesheets",
    icon: CalendarDays,
    permissions: ["ATTENDANCE_READ_ALL"]
  },
  { labelKey: "users", to: "/admin/users", icon: UserRound, roles: adminOnly },
  { labelKey: "departments", to: "/admin/departments", icon: FileText, roles: adminOnly },
  { labelKey: "positions", to: "/admin/positions", icon: BadgeCheck, roles: adminOnly },
  { labelKey: "leave", to: "/admin/leave-balances", icon: CalendarCheck, roles: adminOnly },
  { labelKey: "skills", to: "/admin/skills", icon: BadgeCheck, roles: adminOnly },
  {
    labelKey: "rolesPermissions",
    to: "/admin/roles-permissions",
    icon: ShieldCheck,
    roles: adminOnly
  },
  { labelKey: "auditLogs", to: "/admin/audit-logs", icon: FileClock, roles: adminOnly },
  { labelKey: "policies", to: "/admin/policies", icon: FileText, roles: adminOnly },
  {
    labelKey: "systemSettings",
    to: "/admin/system-settings",
    icon: Settings,
    roles: adminOnly
  }
];
