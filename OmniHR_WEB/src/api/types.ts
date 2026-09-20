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
  managerId?: number | null;
  parent?: Department | null;
  manager?: Employee | null;
  isActive: boolean;
  children?: Department[];
  _count?: { employees: number; teams?: number };
};

export type Position = {
  id: number;
  code: string;
  name: string;
  departmentId?: number | null;
  department?: Department | null;
  isActive: boolean;
  _count?: { employees: number };
};

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type CareerLevel =
  | "INTERN"
  | "FRESHER"
  | "JUNIOR"
  | "MIDDLE"
  | "SENIOR"
  | "LEAD";

export type UserSummary = {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  employee?: Employee | null;
  userRoles?: Array<{ role: { id: number; name: RoleName } }>;
};

export type Employee = {
  id: number;
  employeeCode: string;
  fullName: string;
  companyEmail: string;
  avatarUrl?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  birthDate: string;
  hireDate?: string | null;
  status: EmployeeStatus;
  careerLevel: CareerLevel;
  department?: Department | null;
  position?: Position | null;
  departmentId?: number | null;
  positionId?: number | null;
  user?: UserSummary | null;
  employeeSkills?: EmployeeSkill[];
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
  isPaid: boolean;
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

export type NotificationType =
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "ATTENDANCE_ADJUSTED";

export type Notification = {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  isRead: boolean;
  createdAt: string;
};

export type AttendanceRecordType = "CHECK_IN" | "CHECK_OUT" | "ADJUSTMENT";
export type AttendanceShift = "MORNING" | "AFTERNOON";
export type AttendanceStatus =
  | "ON_TIME"
  | "LATE"
  | "EARLY_OUT"
  | "MANUAL_ADJUSTMENT";

export type AttendanceRecord = {
  id: number;
  employee: Employee;
  employeeId: number;
  workDate: string;
  recordType: AttendanceRecordType;
  recordedAt: string;
  shift?: AttendanceShift | null;
  attendanceStatus?: AttendanceStatus | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  distanceMeters?: number | null;
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

export type TeamMemberRole = "LEAD" | "MEMBER";

export type TeamMember = {
  id: number;
  teamId: number;
  employeeId: number;
  employee: Employee;
  role: TeamMemberRole;
  joinedAt: string;
  leftAt?: string | null;
  isActive: boolean;
};

export type Team = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  departmentId: number;
  department: Department;
  leadId?: number | null;
  lead?: Employee | null;
  members?: TeamMember[];
  isActive: boolean;
  _count?: { members: number; tasks: number };
};

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
export type SkillProficiency = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type TaskSkillImportance = "REQUIRED" | "IMPORTANT" | "NICE_TO_HAVE";
export type TaskAssignmentType = "MANUAL" | "AI_SUGGESTED" | "REASSIGNED";
export type AiTaskSuggestionStatus = "GENERATED" | "SELECTED" | "EXPIRED" | "CANCELLED";

export type Project = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  departmentId?: number | null;
  department?: Department | null;
  managerId?: number | null;
  manager?: Employee | null;
  startDate?: string | null;
  endDate?: string | null;
  _count?: { tasks: number };
};

export type Skill = {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  isActive: boolean;
  positionSkills?: Array<{ positionId: number; skillId: number; position: Position }>;
};

export type EmployeeSkill = {
  id: number;
  employeeId: number;
  employee?: Employee;
  skillId: number;
  skill: Skill;
  yearsExperience?: number | string | null;
  proficiency: SkillProficiency;
  lastUsedAt?: string | null;
  note?: string | null;
};

export type TaskRequiredSkill = {
  id: number;
  skillId: number;
  skill: Skill;
  requiredProficiency: SkillProficiency;
  importance: TaskSkillImportance;
};

export type Task = {
  id: number;
  parentTaskId?: number | null;
  parentTask?: Task | null;
  childTasks?: Task[];
  projectId?: number | null;
  project?: Project | null;
  departmentId?: number | null;
  department?: Department | null;
  teamId?: number | null;
  team?: Team | null;
  title: string;
  description?: string | null;
  technologies: string[];
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: number | null;
  assignee?: Employee | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | string | null;
  actualHours?: number | string | null;
  completedAt?: string | null;
  requiredSkills?: TaskRequiredSkill[];
  _count?: { assignments: number; aiTaskSuggestions: number; childTasks: number };
};

export type TaskAssignment = {
  id: number;
  taskId: number;
  task: Task;
  assigneeId: number;
  assignee: Employee;
  assignedByUser?: UserSummary;
  assignmentType: TaskAssignmentType;
  note?: string | null;
  assignedAt: string;
};

export type WorkloadSummary = {
  employeeId: number;
  activeTaskCount: number;
  totalEstimatedHours: number;
  overdueTaskCount: number;
  capacityHoursPerWeek: number;
  availableHours: number;
  workloadScore: number;
};

export type EmployeeWorkload = {
  employee: Employee;
  workload: WorkloadSummary;
};

export type AiTaskSuggestionItem = {
  id: number;
  suggestionItemId: number;
  employeeId: number;
  employeeCode?: string;
  employee: Employee;
  fullName: string;
  departmentName?: string | null;
  positionName?: string | null;
  rank: number;
  score: number;
  skillScore: number;
  workloadScore: number;
  availabilityScore: number;
  reason?: string | null;
  eligible?: boolean;
  warnings?: string[];
  matchedSkills?: string[];
  missingRequiredSkills?: string[];
  missingImportantSkills?: string[];
  missingNiceToHaveSkills?: string[];
  belowMinimumSkills?: string[];
  skillBreakdown?: Array<{
    skillId: number;
    code: string;
    importance: TaskSkillImportance;
    requiredProficiency: SkillProficiency;
    actualProficiency: SkillProficiency | null;
    score: number;
  }>;
  selected: boolean;
};

export type AiTaskSuggestion = {
  id: number;
  suggestionId: number;
  taskId: number;
  task: Task;
  requestedByUser?: UserSummary;
  algorithmVersion: string;
  status: AiTaskSuggestionStatus;
  createdAt: string;
  expiresAt?: string | null;
  inputSnapshot?: unknown;
  items: AiTaskSuggestionItem[];
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
  activeEmployees: number;
  pendingLeaveRequests: number;
  checkedInToday: number;
  recentAuditLogs: AuditLog[];
};

export type ManagerDashboard = {
  teamEmployees: number;
  pendingTeamLeaves: number;
  teamCheckedInToday: number;
  latestTeamLeaves: LeaveRequest[];
  latestSubordinates: Employee[];
};

export type EmployeeRef = {
  id: number;
  employeeCode: string;
  fullName: string;
  companyEmail: string;
  department?: Pick<Department, "id" | "code" | "name"> | null;
  position?: Pick<Position, "id" | "code" | "name"> | null;
};

export type EmployeeTimesheet = {
  standardWorkDays: number;
  attendanceDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  missingCheckOuts: number;
  workedMinutes: number;
  shiftMinutesPerDay: number;
};

export type TimesheetRow = {
  employee: EmployeeRef;
  timesheet: EmployeeTimesheet;
};

export type LeaveBalanceStatus = "AVAILABLE" | "LOW" | "EXHAUSTED";

export type AnnualLeaveBalance = {
  year: number;
  monthsWorked: number;
  annualAllowance: number;
  seniorityDays: number;
  entitlementDays: number;
  accruedDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
  hireDateMissing: boolean;
  status: LeaveBalanceStatus;
};

export type LeaveBalanceRow = AnnualLeaveBalance & {
  employee: EmployeeRef & { hireDate?: string | null };
};

export type LeaveBalanceList = Paginated<LeaveBalanceRow> & {
  summary: {
    year: number;
    asOf: string;
    annualAllowance: number;
    seniorityEveryYears: number;
    carryOverMaxDays: number;
    annualLeaveTypeConfigured: boolean;
    totalEmployees: number;
    lowCount: number;
    exhaustedCount: number;
    missingHireDateCount: number;
  };
};
