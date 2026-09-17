import { api } from "./axios";
import type {
  AdminDashboard,
  ApiEnvelope,
  AttendanceRecord,
  AuthUser,
  Department,
  Employee,
  EmployeeCreateResult,
  EmployeeSkill,
  EmployeeManager,
  EmployeePasswordResetResult,
  EmployeeWorkload,
  AiTaskSuggestion,
  LeaveRequest,
  LeaveType,
  LoginResponse,
  ManagerDashboard,
  Notification,
  Paginated,
  PerformanceReview,
  Permission,
  Position,
  Project,
  ReviewCycle,
  Role,
  Skill,
  Task,
  TaskAssignment,
  Team,
  UserSummary,
  AuditLog,
  CompensationRow,
  EmployeeCompensation,
  PayrollPeriod,
  PayrollPeriodSummary,
  SendPayslipsResult,
  TimesheetRow,
  LeaveBalanceList
} from "./types";

type QueryParams = Record<string, string | number | boolean | undefined | null>;

export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>) {
  const response = await promise;
  return response.data.data;
}

export const authApi = {
  login: (usernameOrEmail: string, password: string) =>
    unwrap<LoginResponse>(
      api.post("/auth/login", { usernameOrEmail, password })
    ),
  logout: () => unwrap(api.post("/auth/logout")),
  me: () => unwrap<AuthUser>(api.get("/auth/me")),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(api.post("/auth/change-password", { currentPassword, newPassword }))
};

export const dashboardApi = {
  admin: () => unwrap<AdminDashboard>(api.get("/admin/dashboard")),
  manager: () => unwrap<ManagerDashboard>(api.get("/app/dashboard")),
  settings: () => unwrap<Record<string, unknown>>(api.get("/system-settings")),
  updateSettings: (settings: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(api.patch("/system-settings", { settings }))
};

export const employeesApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Employee>>(api.get("/employees", { params })),
  team: (params?: QueryParams) =>
    unwrap<Paginated<Employee>>(api.get("/employees/team", { params })),
  me: () => unwrap<Employee>(api.get("/employees/me")),
  updateMe: (payload: Partial<Employee>) =>
    unwrap<Employee>(api.patch("/employees/me", payload)),
  get: (id: number) => unwrap<Employee>(api.get(`/employees/${id}`)),
  create: (payload: Record<string, unknown>) =>
    unwrap<EmployeeCreateResult>(api.post("/employees", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Employee>(api.patch(`/employees/${id}`, payload)),
  remove: (id: number) => unwrap<Employee>(api.delete(`/employees/${id}`)),
  resetPassword: (id: number) =>
    unwrap<EmployeePasswordResetResult>(
      api.post(`/employees/${id}/reset-password`)
    ),
  lockUser: (id: number) => unwrap(api.post(`/employees/${id}/lock-user`)),
  unlockUser: (id: number) => unwrap(api.post(`/employees/${id}/unlock-user`))
};

export const departmentsApi = {
  list: (search?: string) =>
    unwrap<Department[]>(api.get("/departments", { params: { search } })),
  tree: () => unwrap<Department[]>(api.get("/departments/tree")),
  create: (payload: Record<string, unknown>) =>
    unwrap<Department>(api.post("/departments", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Department>(api.patch(`/departments/${id}`, payload)),
  remove: (id: number) => unwrap<Department>(api.delete(`/departments/${id}`))
};

export const teamsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Team>>(api.get("/teams", { params })),
  get: (id: number) => unwrap<Team>(api.get(`/teams/${id}`)),
  create: (payload: Record<string, unknown>) =>
    unwrap<Team>(api.post("/teams", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Team>(api.patch(`/teams/${id}`, payload)),
  remove: (id: number) => unwrap<Team>(api.delete(`/teams/${id}`)),
  addMember: (id: number, payload: Record<string, unknown>) =>
    unwrap<Team>(api.post(`/teams/${id}/members`, payload)),
  updateMember: (id: number, memberId: number, payload: Record<string, unknown>) =>
    unwrap<Team>(api.patch(`/teams/${id}/members/${memberId}`, payload)),
  removeMember: (id: number, memberId: number) =>
    unwrap<Team>(api.delete(`/teams/${id}/members/${memberId}`))
};

export const projectsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Project>>(api.get("/projects", { params })),
  get: (id: number) => unwrap<Project>(api.get(`/projects/${id}`)),
  create: (payload: Record<string, unknown>) =>
    unwrap<Project>(api.post("/projects", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Project>(api.patch(`/projects/${id}`, payload)),
  remove: (id: number) => unwrap<Project>(api.delete(`/projects/${id}`))
};

export const skillsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Skill>>(api.get("/skills", { params })),
  create: (payload: Record<string, unknown>) =>
    unwrap<Skill>(api.post("/skills", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Skill>(api.patch(`/skills/${id}`, payload)),
  remove: (id: number) => unwrap<Skill>(api.delete(`/skills/${id}`))
};

export const employeeSkillsApi = {
  list: (employeeId: number) =>
    unwrap<EmployeeSkill[]>(api.get(`/employees/${employeeId}/skills`)),
  create: (employeeId: number, payload: Record<string, unknown>) =>
    unwrap<EmployeeSkill>(api.post(`/employees/${employeeId}/skills`, payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<EmployeeSkill>(api.patch(`/employee-skills/${id}`, payload)),
  remove: (id: number) => unwrap<EmployeeSkill>(api.delete(`/employee-skills/${id}`))
};

export const tasksApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Task>>(api.get("/tasks", { params })),
  team: (params?: QueryParams) =>
    unwrap<Paginated<Task>>(api.get("/tasks/team", { params })),
  me: (params?: QueryParams) =>
    unwrap<Paginated<Task>>(api.get("/tasks/me", { params })),
  get: (id: number) => unwrap<Task>(api.get(`/tasks/${id}`)),
  create: (payload: Record<string, unknown>) =>
    unwrap<Task>(api.post("/tasks", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Task>(api.patch(`/tasks/${id}`, payload)),
  remove: (id: number) => unwrap<Task>(api.delete(`/tasks/${id}`)),
  assign: (id: number, payload: Record<string, unknown>) =>
    unwrap<Task>(api.post(`/tasks/${id}/assign`, payload)),
  updateStatus: (id: number, payload: Record<string, unknown>) =>
    unwrap<Task>(api.patch(`/tasks/${id}/status`, payload))
};

export const taskAssignmentsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<TaskAssignment>>(api.get("/task-assignments", { params }))
};

export const taskWorkloadApi = {
  list: (params?: QueryParams) =>
    unwrap<EmployeeWorkload[]>(api.get("/task-workload", { params }))
};

export const aiTaskSuggestionsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<AiTaskSuggestion>>(
      api.get("/ai-task-suggestions", { params })
    ),
  byTask: (taskId: number) =>
    unwrap<AiTaskSuggestion[]>(api.get(`/tasks/${taskId}/ai-suggestions`)),
  generate: (taskId: number, payload: Record<string, unknown>) =>
    unwrap<AiTaskSuggestion>(
      api.post(`/tasks/${taskId}/ai-suggestions`, payload)
    ),
  select: (id: number, payload: Record<string, unknown>) =>
    unwrap<AiTaskSuggestion>(api.post(`/ai-task-suggestions/${id}/select`, payload)),
  cancel: (id: number, payload?: Record<string, unknown>) =>
    unwrap<AiTaskSuggestion>(
      api.post(`/ai-task-suggestions/${id}/cancel`, payload ?? {})
    )
};

export const positionsApi = {
  list: (params?: QueryParams | string) =>
    unwrap<Position[]>(
      api.get("/positions", {
        params: typeof params === "string" ? { search: params } : params
      })
    ),
  create: (payload: Record<string, unknown>) =>
    unwrap<Position>(api.post("/positions", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Position>(api.patch(`/positions/${id}`, payload)),
  remove: (id: number) => unwrap<Position>(api.delete(`/positions/${id}`))
};

export const managersApi = {
  list: () => unwrap<EmployeeManager[]>(api.get("/employee-managers")),
  assign: (payload: Record<string, unknown>) =>
    unwrap<EmployeeManager>(api.post("/employee-managers", payload)),
  end: (id: number, payload: Record<string, unknown>) =>
    unwrap<EmployeeManager>(api.patch(`/employee-managers/${id}/end`, payload))
};

export const attendanceApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<AttendanceRecord>>(api.get("/attendance", { params })),
  self: (params?: QueryParams) =>
    unwrap<Paginated<AttendanceRecord>>(api.get("/attendance/self", { params })),
  team: (params?: QueryParams) =>
    unwrap<Paginated<AttendanceRecord>>(api.get("/attendance/team", { params })),
  timesheets: (params?: QueryParams) =>
    unwrap<Paginated<TimesheetRow>>(api.get("/attendance/timesheets", { params })),
  checkIn: (payload?: Record<string, unknown>) =>
    unwrap<AttendanceRecord>(api.post("/attendance/check-in", payload ?? {})),
  checkOut: (payload?: Record<string, unknown>) =>
    unwrap<AttendanceRecord>(api.post("/attendance/check-out", payload ?? {})),
  adminCreate: (payload: Record<string, unknown>) =>
    unwrap<AttendanceRecord>(api.post("/attendance/admin", payload)),
  adminUpdate: (id: number, payload: Record<string, unknown>) =>
    unwrap<AttendanceRecord>(api.patch(`/attendance/${id}`, payload))
};

export const leaveTypesApi = {
  list: () => unwrap<LeaveType[]>(api.get("/leave-types")),
  create: (payload: Record<string, unknown>) =>
    unwrap<LeaveType>(api.post("/leave-types", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<LeaveType>(api.patch(`/leave-types/${id}`, payload)),
  remove: (id: number) => unwrap<LeaveType>(api.delete(`/leave-types/${id}`))
};

export const leaveRequestsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<LeaveRequest>>(api.get("/leave-requests", { params })),
  self: (params?: QueryParams) =>
    unwrap<Paginated<LeaveRequest>>(
      api.get("/leave-requests/self", { params })
    ),
  team: (params?: QueryParams) =>
    unwrap<Paginated<LeaveRequest>>(
      api.get("/leave-requests/team", { params })
    ),
  create: (payload: Record<string, unknown>) =>
    unwrap<LeaveRequest>(api.post("/leave-requests", payload)),
  approve: (id: number) =>
    unwrap<LeaveRequest>(api.post(`/leave-requests/${id}/approve`)),
  reject: (id: number, rejectionReason: string) =>
    unwrap<LeaveRequest>(
      api.post(`/leave-requests/${id}/reject`, { rejectionReason })
    ),
  cancel: (id: number) =>
    unwrap<LeaveRequest>(api.post(`/leave-requests/${id}/cancel`))
};

export const usersApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<UserSummary>>(api.get("/users", { params })),
  create: (payload: Record<string, unknown>) =>
    unwrap<UserSummary>(api.post("/users", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<UserSummary>(api.patch(`/users/${id}`, payload)),
  remove: (id: number) => unwrap<UserSummary>(api.delete(`/users/${id}`)),
  resetPassword: (id: number, payload: Record<string, unknown>) =>
    unwrap<UserSummary>(api.post(`/users/${id}/reset-password`, payload))
};

export const rolesApi = {
  list: () => unwrap<Role[]>(api.get("/roles")),
  create: (payload: Record<string, unknown>) =>
    unwrap<Role>(api.post("/roles", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<Role>(api.patch(`/roles/${id}`, payload)),
  remove: (id: number) => unwrap<Role>(api.delete(`/roles/${id}`)),
  assignPermission: (id: number, permissionId: number) =>
    unwrap<Role>(api.post(`/roles/${id}/permissions`, { permissionId })),
  removePermission: (id: number, permissionId: number) =>
    unwrap<Role>(api.delete(`/roles/${id}/permissions/${permissionId}`))
};

export const permissionsApi = {
  list: () => unwrap<Permission[]>(api.get("/permissions"))
};

export const notificationsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<Notification>>(api.get("/notifications", { params })),
  unreadCount: () => unwrap<number>(api.get("/notifications/unread-count")),
  markRead: (id: number) =>
    unwrap<Notification>(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(api.patch("/notifications/read-all"))
};

export const reviewCyclesApi = {
  list: () => unwrap<ReviewCycle[]>(api.get("/review-cycles")),
  create: (payload: Record<string, unknown>) =>
    unwrap<ReviewCycle>(api.post("/review-cycles", payload)),
  update: (id: number, payload: Record<string, unknown>) =>
    unwrap<ReviewCycle>(api.patch(`/review-cycles/${id}`, payload)),
  launch: (id: number) =>
    unwrap<{ createdCount: number }>(api.post(`/review-cycles/${id}/launch`))
};

export const performanceReviewsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<PerformanceReview>>(api.get("/performance-reviews", { params })),
  team: (params?: QueryParams) =>
    unwrap<Paginated<PerformanceReview>>(
      api.get("/performance-reviews/team", { params })
    ),
  self: (params?: QueryParams) =>
    unwrap<Paginated<PerformanceReview>>(
      api.get("/performance-reviews/self", { params })
    ),
  submitSelf: (id: number, payload: Record<string, unknown>) =>
    unwrap<PerformanceReview>(
      api.patch(`/performance-reviews/${id}/submit-self`, payload)
    ),
  submitManager: (id: number, payload: Record<string, unknown>) =>
    unwrap<PerformanceReview>(
      api.patch(`/performance-reviews/${id}/submit-manager`, payload)
    ),
  finalize: (id: number, payload?: Record<string, unknown>) =>
    unwrap<PerformanceReview>(
      api.patch(`/performance-reviews/${id}/finalize`, payload ?? {})
    )
};

export const auditLogsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<AuditLog>>(api.get("/audit-logs", { params }))
};

export const payrollApi = {
  compensations: (params?: QueryParams) =>
    unwrap<Paginated<CompensationRow>>(api.get("/payroll/compensations", { params })),
  upsertCompensation: (employeeId: number, payload: Record<string, unknown>) =>
    unwrap<EmployeeCompensation>(api.put(`/payroll/compensations/${employeeId}`, payload)),
  periods: () => unwrap<PayrollPeriodSummary[]>(api.get("/payroll/periods")),
  period: (id: number) => unwrap<PayrollPeriod>(api.get(`/payroll/periods/${id}`)),
  createPeriod: (payload: { year: number; month: number }) =>
    unwrap<PayrollPeriod>(api.post("/payroll/periods", payload)),
  calculate: (id: number) =>
    unwrap<PayrollPeriod>(api.post(`/payroll/periods/${id}/calculate`)),
  finalize: (id: number) =>
    unwrap<PayrollPeriod>(api.post(`/payroll/periods/${id}/finalize`)),
  sendPayslips: (id: number, payload: { employeeIds?: number[]; onlyUnsent?: boolean }) =>
    unwrap<SendPayslipsResult>(api.post(`/payroll/periods/${id}/send-payslips`, payload)),
  removePeriod: (id: number) =>
    unwrap<{ id: number }>(api.delete(`/payroll/periods/${id}`))
};

export const leaveBalancesApi = {
  list: (params?: QueryParams) =>
    unwrap<LeaveBalanceList>(api.get("/leave-balances", { params }))
};
