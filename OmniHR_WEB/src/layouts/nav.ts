import {
  Activity,
  BadgeCheck,
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileClock,
  FileText,
  Network,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
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
  { labelKey: "teamReviews", to: "/app/team-reviews", icon: Star },
  { labelKey: "myProfile", to: "/app/profile", icon: UserRound }
];

export const adminNavItems: NavItem[] = [
  { labelKey: "dashboard", to: "/admin/dashboard", icon: BarChart3 },
  { labelKey: "orgChart", to: "/admin/org-chart", icon: Network },
  { labelKey: "reviewCycles", to: "/admin/review-cycles", icon: Star },
  { labelKey: "reviews", to: "/admin/reviews", icon: Star },
  { labelKey: "users", to: "/admin/users", icon: UserRound },
  { labelKey: "departments", to: "/admin/departments", icon: FileText },
  { labelKey: "positions", to: "/admin/positions", icon: BadgeCheck },
  { labelKey: "leaveTypes", to: "/admin/leave-types", icon: FileText },
  { labelKey: "skills", to: "/admin/skills", icon: BadgeCheck },
  {
    labelKey: "rolesPermissions",
    to: "/admin/roles-permissions",
    icon: ShieldCheck
  },
  { labelKey: "auditLogs", to: "/admin/audit-logs", icon: FileClock },
  { labelKey: "policies", to: "/admin/policies", icon: FileText },
  { labelKey: "systemSettings", to: "/admin/system-settings", icon: Settings }
];
