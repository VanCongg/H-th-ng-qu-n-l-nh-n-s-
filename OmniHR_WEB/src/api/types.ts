export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
};

export type RoleName = "ADMIN" | "MANAGER" | "EMPLOYEE";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  roles: RoleName[];
  permissions: string[];
  employeeId?: number | null;
  mustChangePassword: boolean;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
};

export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

export type Department = {
  id: number;
  code: string;
  name: string;
  parentId?: number | null;
  isActive: boolean;
  children?: Department[];
  _count?: { employees: number };
};

export type Position = {
  id: number;
  code: string;
  name: string;
  level: number;
  isActive: boolean;
  _count?: { employees: number };
};

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

export type UserSummary = {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  userRoles?: Array<{ role: { id: number; name: RoleName } }>;
};

export type Employee = {
  id: number;
  employeeCode: string;
  fullName: string;
  companyEmail: string;
  personalEmail?: string | null;
  phone?: string | null;
  birthDate: string;
  hireDate?: string | null;
  status: EmployeeStatus;
  department?: Department | null;
  position?: Position | null;
  departmentId?: number | null;
  positionId?: number | null;
  user?: UserSummary | null;
};

export type EmployeeCreateResult = {
  employeeId: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  companyEmail: string;
  username: string;
  defaultPassword: string;
  mustChangePassword: boolean;
  employee: Employee;
};

export type EmployeePasswordResetResult = {
  employeeId: number;
  userId: number;
  username: string;
  defaultPassword: string;
  mustChangePassword: boolean;
};

export type LeaveType = {
  id: number;
  code: string;
  name: string;
  annualAllowance?: number | null;
  isActive: boolean;
};

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveRequest = {
  id: number;
  employee: Employee;
  employeeId: number;
  leaveType: LeaveType;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason?: string | null;
  approver?: UserSummary | null;
  approvedAt?: string | null;
  createdAt: string;
};

export type AttendanceRecordType = "CHECK_IN" | "CHECK_OUT" | "ADJUSTMENT";

export type AttendanceRecord = {
  id: number;
  employee: Employee;
  employeeId: number;
  workDate: string;
  recordType: AttendanceRecordType;
  recordedAt: string;
  source: string;
  note?: string | null;
  isAdjustment: boolean;
};

export type Role = {
  id: number;
  name: RoleName;
  description?: string | null;
  isSystem: boolean;
  rolePermissions?: Array<{ permission: Permission }>;
  _count?: { userRoles: number };
};

export type Permission = {
  id: number;
  code: string;
  description?: string | null;
};

export type EmployeeManager = {
  id: number;
  employee: Employee;
  employeeId: number;
  manager: Employee;
  managerId: number;
  managerType: "DIRECT" | "PROJECT";
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
};

export type AuditLog = {
  id: number;
  user?: UserSummary | null;
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export type AdminDashboard = {
  totalEmployees: number;
  totalDepartments: number;
  totalPositions: number;
  activeUsers: number;
  pendingLeaveRequests: number;
  todayAttendanceRecords: number;
  recentAuditLogs: AuditLog[];
};

export type ManagerDashboard = {
  teamEmployees: number;
  pendingTeamLeaves: number;
  todayTeamAttendance: number;
  latestTeamLeaves: LeaveRequest[];
  latestSubordinates: Employee[];
};
