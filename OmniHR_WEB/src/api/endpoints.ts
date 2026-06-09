import { api } from "./axios";
import type {
  AdminDashboard,
  ApiEnvelope,
  AttendanceRecord,
  AuthUser,
  Department,
  Employee,
  EmployeeCreateResult,
  EmployeeManager,
  EmployeePasswordResetResult,
  LeaveRequest,
  LeaveType,
  LoginResponse,
  ManagerDashboard,
  Paginated,
  Permission,
  Position,
  Role,
  UserSummary,
  AuditLog
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

export const positionsApi = {
  list: (search?: string) =>
    unwrap<Position[]>(api.get("/positions", { params: { search } })),
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
  checkIn: () => unwrap<AttendanceRecord>(api.post("/attendance/check-in")),
  checkOut: () => unwrap<AttendanceRecord>(api.post("/attendance/check-out")),
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

export const auditLogsApi = {
  list: (params?: QueryParams) =>
    unwrap<Paginated<AuditLog>>(api.get("/audit-logs", { params }))
};
