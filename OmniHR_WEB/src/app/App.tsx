import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { AuthHydrator, RequireAuth, RequireRole, RootRedirect } from "./guards";
import { LoginPage } from "../features/auth/LoginPage";
import { ForbiddenPage, MobileNoticePage } from "../features/auth/StatusPages";
import { AppDashboardPage } from "../features/app-dashboard/AppDashboardPage";
import { AdminDashboardPage } from "../features/admin-dashboard/AdminDashboardPage";
import { EmployeesPage } from "../features/employees/EmployeesPage";
import { DepartmentsPage } from "../features/departments/DepartmentsPage";
import { TeamsPage } from "../features/teams/TeamsPage";
import { PositionsPage } from "../features/positions/PositionsPage";
import { AttendancePage } from "../features/attendance/AttendancePage";
import { LeaveRequestsPage } from "../features/leave-requests/LeaveRequestsPage";
import { LeaveTypesPage } from "../features/leave-types/LeaveTypesPage";
import { UsersPage } from "../features/users/UsersPage";
import { RolesPermissionsPage } from "../features/roles-permissions/RolesPermissionsPage";
import { PoliciesPage } from "../features/policies/PoliciesPage";
import { AuditLogsPage } from "../features/audit-logs/AuditLogsPage";
import { SystemSettingsPage } from "../features/system-settings/SystemSettingsPage";
import { MyProfilePage } from "../features/employees/MyProfilePage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { TasksPage } from "../features/tasks/TasksPage";
import { SkillsPage } from "../features/skills/SkillsPage";
import { EmployeeSkillsPage } from "../features/employee-skills/EmployeeSkillsPage";
import { AiTaskSuggestionsPage } from "../features/ai-task-suggestions/AiTaskSuggestionsPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthHydrator />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/employee-web-notice" element={<MobileNoticePage />} />
          <Route element={<RequireAuth />}>
            <Route index element={<RootRedirect />} />
            <Route element={<RequireRole roles={["MANAGER"]} />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<AppDashboardPage />} />
                <Route path="teams" element={<TeamsPage scope="managed" />} />
                <Route path="team" element={<EmployeesPage scope="team" />} />
                <Route
                  path="employee-skills"
                  element={<EmployeeSkillsPage scope="team" />}
                />
                <Route
                  path="team-attendance"
                  element={<AttendancePage scope="team" />}
                />
                <Route
                  path="team-leave-requests"
                  element={<LeaveRequestsPage scope="team" />}
                />
                <Route path="projects" element={<ProjectsPage scope="team" />} />
                <Route path="team-tasks" element={<TasksPage scope="team" />} />
                <Route
                  path="assign-task"
                  element={<TasksPage scope="team" mode="assign" />}
                />
                <Route
                  path="ai-task-suggestions"
                  element={<AiTaskSuggestionsPage scope="team" />}
                />
                <Route path="profile" element={<MyProfilePage />} />
              </Route>
            </Route>
            <Route element={<RequireRole roles={["ADMIN"]} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="employees" element={<Navigate to="/admin/users" replace />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="positions" element={<PositionsPage />} />
                <Route path="leave-types" element={<LeaveTypesPage />} />
                <Route path="skills" element={<SkillsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route
                  path="roles-permissions"
                  element={<RolesPermissionsPage />}
                />
                <Route path="policies" element={<PoliciesPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="system-settings" element={<SystemSettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
