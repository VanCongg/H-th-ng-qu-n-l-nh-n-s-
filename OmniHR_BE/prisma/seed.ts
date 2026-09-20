import {
  AttendanceRecordType,
  AttendanceShift,
  AttendanceStatus,
  CareerLevel,
  EmployeeStatus,
  LeaveRequestStatus,
  ManagerType,
  NotificationType,
  Prisma,
  PrismaClient,
  ProjectStatus,
  SkillProficiency,
  TaskAssignmentType,
  TaskPriority,
  TaskSkillImportance,
  TaskStatus,
  TeamMemberRole
} from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Seeds a fresh database with one consistent demo company. Every record obeys
 * the same rules the API enforces (department heads, team membership, manager
 * positions, leave accrual, task hierarchy, shift-based attendance), so any
 * screen can be exercised without hitting a validation error on seeded data.
 *
 * Run it on an empty database: `npx prisma migrate reset` wipes, migrates and
 * seeds in one step. Dates are relative to today, so attendance, leave and
 * task deadlines always look current.
 */

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const roles = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
type RoleName = (typeof roles)[number];

const permissions = [
  "USER_CREATE",
  "USER_READ",
  "USER_UPDATE",
  "USER_DELETE",
  "ROLE_CREATE",
  "ROLE_READ",
  "ROLE_UPDATE",
  "ROLE_DELETE",
  "ROLE_ASSIGN",
  "PERMISSION_READ",
  "PERMISSION_ASSIGN",
  "EMPLOYEE_CREATE",
  "EMPLOYEE_READ_ALL",
  "EMPLOYEE_READ_TEAM",
  "EMPLOYEE_READ_SELF",
  "EMPLOYEE_UPDATE_ALL",
  "EMPLOYEE_UPDATE_SELF",
  "EMPLOYEE_DELETE",
  "DEPARTMENT_CREATE",
  "DEPARTMENT_READ",
  "DEPARTMENT_UPDATE",
  "DEPARTMENT_DELETE",
  "TEAM_CREATE",
  "TEAM_READ",
  "TEAM_UPDATE",
  "TEAM_DELETE",
  "POSITION_CREATE",
  "POSITION_READ",
  "POSITION_UPDATE",
  "POSITION_DELETE",
  "MANAGER_ASSIGN",
  "MANAGER_READ",
  "MANAGER_REMOVE",
  "ATTENDANCE_CHECK_IN",
  "ATTENDANCE_CHECK_OUT",
  "ATTENDANCE_READ_ALL",
  "ATTENDANCE_READ_TEAM",
  "ATTENDANCE_READ_SELF",
  "ATTENDANCE_ADJUST",
  "LEAVE_TYPE_CREATE",
  "LEAVE_TYPE_READ",
  "LEAVE_TYPE_UPDATE",
  "LEAVE_TYPE_DELETE",
  "LEAVE_CREATE",
  "LEAVE_READ_ALL",
  "LEAVE_READ_TEAM",
  "LEAVE_READ_SELF",
  "LEAVE_APPROVE",
  "LEAVE_REJECT",
  "LEAVE_CANCEL_SELF",
  "AUDIT_LOG_READ",
  "SYSTEM_SETTING_READ",
  "SYSTEM_SETTING_UPDATE",
  "PROJECT_CREATE",
  "PROJECT_READ_ALL",
  "PROJECT_READ_TEAM",
  "PROJECT_UPDATE",
  "PROJECT_DELETE",
  "TASK_CREATE",
  "TASK_READ_ALL",
  "TASK_READ_TEAM",
  "TASK_READ_SELF",
  "TASK_UPDATE",
  "TASK_DELETE",
  "TASK_ASSIGN",
  "TASK_UPDATE_STATUS",
  "SKILL_CREATE",
  "SKILL_READ",
  "SKILL_UPDATE",
  "SKILL_DELETE",
  "EMPLOYEE_SKILL_CREATE",
  "EMPLOYEE_SKILL_READ",
  "EMPLOYEE_SKILL_UPDATE",
  "EMPLOYEE_SKILL_DELETE",
  "AI_TASK_SUGGEST",
  "AI_TASK_SELECT",
  "TASK_ASSIGNMENT_READ"
] as const;

const employeePermissions = [
  "EMPLOYEE_READ_SELF",
  "EMPLOYEE_UPDATE_SELF",
  "ATTENDANCE_CHECK_IN",
  "ATTENDANCE_CHECK_OUT",
  "ATTENDANCE_READ_SELF",
  "LEAVE_CREATE",
  "LEAVE_READ_SELF",
  "LEAVE_CANCEL_SELF",
  "LEAVE_TYPE_READ",
  "MANAGER_READ",
  "TASK_READ_SELF",
  "TASK_UPDATE_STATUS",
  "SKILL_READ",
  "EMPLOYEE_SKILL_READ",
  "EMPLOYEE_SKILL_CREATE",
  "EMPLOYEE_SKILL_UPDATE",
  "EMPLOYEE_SKILL_DELETE"
] as const;

const managerExtraPermissions = [
  "EMPLOYEE_READ_TEAM",
  "ATTENDANCE_READ_TEAM",
  "LEAVE_READ_TEAM",
  "LEAVE_APPROVE",
  "LEAVE_REJECT",
  "DEPARTMENT_READ",
  "TEAM_READ",
  "TEAM_CREATE",
  "TEAM_UPDATE",
  "PROJECT_CREATE",
  "PROJECT_READ_TEAM",
  "TASK_CREATE",
  "TASK_READ_TEAM",
  "TASK_UPDATE",
  "TASK_ASSIGN",
  "AI_TASK_SUGGEST",
  "AI_TASK_SELECT",
  "TASK_ASSIGNMENT_READ"
] as const;

const rolePermissions: Record<RoleName, readonly string[]> = {
  ADMIN: permissions,
  MANAGER: unique([...employeePermissions, ...managerExtraPermissions]),
  EMPLOYEE: employeePermissions
};

// ---------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------

// [code, name, annualAllowance, isPaid]. Maternity leave is paid by social
// insurance rather than the company, so it does not count as a paid work day.
const leaveTypes = [
  ["ANNUAL_LEAVE", "Nghỉ phép năm", 12, true],
  ["SICK_LEAVE", "Nghỉ ốm", 30, true],
  ["UNPAID_LEAVE", "Nghỉ không lương", null, false],
  ["MATERNITY_LEAVE", "Nghỉ thai sản", 180, false],
  ["MARRIAGE_LEAVE", "Nghỉ kết hôn", 3, true],
  ["BEREAVEMENT_LEAVE", "Nghỉ tang chế", 3, true]
] as const;

// [code, name, category]
const skills: ReadonlyArray<readonly [string, string, string]> = [
  // Engineering
  ["ACTIVE_DIRECTORY", "Active Directory", "Infrastructure"],
  ["AGILE_SCRUM", "Agile/Scrum", "Management"],
  ["ANDROID", "Android", "Mobile"],
  ["API_TESTING", "API Testing", "Quality"],
  ["AUTOMATION_TESTING", "Automation Testing", "Quality"],
  ["AWS", "Amazon Web Services", "Cloud"],
  ["BPMN", "BPMN", "Business Analysis"],
  ["CI_CD", "CI/CD", "DevOps"],
  ["CODE_REVIEW", "Code Review", "Engineering"],
  ["CSS", "CSS", "Frontend"],
  ["DART", "Dart", "Mobile"],
  ["DESIGN_PATTERNS", "Design Patterns", "Engineering"],
  ["DOCKER", "Docker", "DevOps"],
  ["DOCUMENTATION", "Documentation", "Business Analysis"],
  ["FIGMA", "Figma", "Design"],
  ["FIREBASE", "Firebase", "Mobile"],
  ["FLUTTER", "Flutter", "Mobile"],
  ["GIT", "Git", "Engineering"],
  ["GITHUB_ACTIONS", "GitHub Actions", "DevOps"],
  ["GRAFANA", "Grafana", "DevOps"],
  ["HELPDESK", "Helpdesk", "IT Support"],
  ["HTML", "HTML", "Frontend"],
  ["IOS", "iOS", "Mobile"],
  ["JAVASCRIPT", "JavaScript", "Frontend"],
  ["KOTLIN", "Kotlin", "Mobile"],
  ["KUBERNETES", "Kubernetes", "DevOps"],
  ["LINUX", "Linux", "Infrastructure"],
  ["M365", "Microsoft 365", "IT Support"],
  ["MANUAL_TESTING", "Manual Testing", "Quality"],
  ["MICROSERVICES", "Microservices", "Architecture"],
  ["MOBILE_CI_CD", "Mobile CI/CD", "Mobile"],
  ["MONITORING", "Monitoring", "DevOps"],
  ["MYSQL", "MySQL", "Database"],
  ["NESTJS", "NestJS", "Backend"],
  ["NEXTJS", "Next.js", "Frontend"],
  ["NGINX", "Nginx", "Infrastructure"],
  ["NODEJS", "Node.js", "Backend"],
  ["OOP", "OOP", "Engineering"],
  ["PERFORMANCE_TESTING", "Performance Testing", "Quality"],
  ["PLAYWRIGHT", "Playwright", "Quality"],
  ["POSTGRESQL", "PostgreSQL", "Database"],
  ["PRISMA", "Prisma", "Backend"],
  ["PRODUCT_DISCOVERY", "Product Discovery", "Product"],
  ["PROMETHEUS", "Prometheus", "DevOps"],
  ["RABBITMQ", "RabbitMQ", "Backend"],
  ["REACT", "React", "Frontend"],
  ["REDIS", "Redis", "Backend"],
  ["REQUIREMENT_ANALYSIS", "Requirement Analysis", "Business Analysis"],
  ["REST_API", "REST API", "Backend"],
  ["ROADMAP", "Roadmap Planning", "Product"],
  ["SELENIUM", "Selenium", "Quality"],
  ["SOLID", "SOLID", "Engineering"],
  ["SQL", "SQL", "Database"],
  ["SWIFT", "Swift", "Mobile"],
  ["SYSTEM_DESIGN", "System Design", "Architecture"],
  ["TAILWIND", "Tailwind CSS", "Frontend"],
  ["TERRAFORM", "Terraform", "DevOps"],
  ["TESTING", "Testing", "Quality"],
  ["TYPESCRIPT", "TypeScript", "Engineering"],
  ["UI_UX", "UI/UX", "Design"],
  ["USER_STORY", "User Story", "Business Analysis"],
  ["VUE", "Vue.js", "Frontend"],
  ["PYTHON", "Python", "Data & AI"],
  ["FASTAPI", "FastAPI", "Data & AI"],
  ["MACHINE_LEARNING", "Machine Learning", "Data & AI"],
  ["LLM", "Large Language Models", "Data & AI"],
  ["RAG", "Retrieval-Augmented Generation", "Data & AI"],
  ["DATA_ENGINEERING", "Data Engineering", "Data & AI"],
  // Management & soft skills
  ["PEOPLE_MANAGEMENT", "Quản lý con người", "Management"],
  ["PROJECT_PLANNING", "Lập kế hoạch dự án", "Management"],
  ["RISK_MANAGEMENT", "Quản lý rủi ro", "Management"],
  ["STAKEHOLDER_MANAGEMENT", "Quản lý các bên liên quan", "Management"],
  ["TEAM_LEADERSHIP", "Lãnh đạo nhóm", "Management"],
  ["PRESENTATION", "Thuyết trình", "Soft Skills"],
  ["EXCEL", "Microsoft Excel", "Office"],
  // Human resources
  ["RECRUITMENT", "Tuyển dụng", "Human Resources"],
  ["INTERVIEWING", "Kỹ năng phỏng vấn", "Human Resources"],
  ["EMPLOYER_BRANDING", "Thương hiệu tuyển dụng", "Human Resources"],
  ["TRAINING_DESIGN", "Thiết kế chương trình đào tạo", "Human Resources"],
  ["LABOR_LAW", "Luật Lao động", "Human Resources"],
  ["PAYROLL_CB", "Tính lương & C&B", "Human Resources"],
  ["SOCIAL_INSURANCE", "Bảo hiểm xã hội", "Human Resources"],
  ["HRIS", "Hệ thống HRIS", "Human Resources"],
  // Finance
  ["ACCOUNTING_VAS", "Chuẩn mực kế toán Việt Nam (VAS)", "Finance"],
  ["TAX", "Thuế doanh nghiệp", "Finance"],
  ["FINANCIAL_REPORTING", "Báo cáo tài chính", "Finance"],
  ["BUDGETING", "Lập ngân sách", "Finance"],
  ["COST_CONTROL", "Kiểm soát chi phí", "Finance"],
  ["MISA", "Phần mềm kế toán MISA", "Finance"],
  // Sales
  ["B2B_SALES", "Bán hàng B2B", "Sales"],
  ["NEGOTIATION", "Đàm phán", "Sales"],
  ["CRM", "Quản lý quan hệ khách hàng (CRM)", "Sales"],
  ["ACCOUNT_MANAGEMENT", "Quản lý khách hàng doanh nghiệp", "Sales"],
  ["MARKET_RESEARCH", "Nghiên cứu thị trường", "Sales"],
  ["PRESALES_SOLUTION", "Tư vấn giải pháp (Presales)", "Sales"],
  // Operations
  ["CUSTOMER_SERVICE", "Chăm sóc khách hàng", "Operations"],
  ["PROCUREMENT", "Mua hàng", "Operations"],
  ["VENDOR_MANAGEMENT", "Quản lý nhà cung cấp", "Operations"],
  ["OFFICE_ADMIN", "Hành chính văn phòng", "Operations"],
  ["ASSET_MANAGEMENT", "Quản lý tài sản", "Operations"]
];

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

const departments = [
  ["IT", "Công nghệ thông tin"],
  ["HR", "Nhân sự"],
  ["FIN", "Tài chính - Kế toán"],
  ["SALES", "Kinh doanh"],
  ["OPS", "Hành chính - Vận hành"]
] as const;
type DepartmentCode = (typeof departments)[number][0];

/**
 * [code, name, department, skills]. Skills are ordered by importance: an
 * employee without an explicit skill list gets the first few for their level.
 * Names containing "Trưởng" are manager positions and require the MANAGER
 * role, exactly as `isManagerPosition` decides in the API.
 */
const positions: ReadonlyArray<readonly [string, string, DepartmentCode, readonly string[]]> = [
  ["IT_HEAD", "Trưởng phòng Công nghệ thông tin", "IT", ["AGILE_SCRUM", "PROJECT_PLANNING", "ROADMAP", "SYSTEM_DESIGN", "RISK_MANAGEMENT", "PEOPLE_MANAGEMENT", "STAKEHOLDER_MANAGEMENT", "TEAM_LEADERSHIP"]],
  ["IT_TECH_LEAD", "Trưởng nhóm kỹ thuật", "IT", ["SYSTEM_DESIGN", "CODE_REVIEW", "TEAM_LEADERSHIP", "DESIGN_PATTERNS", "AGILE_SCRUM", "TYPESCRIPT", "NESTJS", "NODEJS", "POSTGRESQL", "REACT", "NEXTJS", "FLUTTER", "FIREBASE", "REST_API", "DOCKER", "KUBERNETES", "CI_CD", "TERRAFORM", "LINUX", "AWS", "MICROSERVICES", "SWIFT", "KOTLIN", "PYTHON", "LLM", "RAG", "MACHINE_LEARNING", "FASTAPI"]],
  ["IT_QA_LEAD", "Trưởng nhóm kiểm thử", "IT", ["MANUAL_TESTING", "AUTOMATION_TESTING", "API_TESTING", "PLAYWRIGHT", "PERFORMANCE_TESTING", "TEAM_LEADERSHIP", "AGILE_SCRUM", "TESTING"]],
  ["IT_PRODUCT_LEAD", "Trưởng nhóm sản phẩm", "IT", ["PRODUCT_DISCOVERY", "ROADMAP", "REQUIREMENT_ANALYSIS", "USER_STORY", "STAKEHOLDER_MANAGEMENT", "TEAM_LEADERSHIP", "AGILE_SCRUM", "UI_UX"]],
  ["BE_DEV", "Lập trình viên Backend", "IT", ["NESTJS", "NODEJS", "TYPESCRIPT", "POSTGRESQL", "PRISMA", "REST_API", "REDIS", "DOCKER", "TESTING", "GIT", "SOLID", "RABBITMQ", "MYSQL", "OOP", "MICROSERVICES"]],
  ["FE_DEV", "Lập trình viên Frontend", "IT", ["REACT", "TYPESCRIPT", "JAVASCRIPT", "CSS", "HTML", "NEXTJS", "TAILWIND", "TESTING", "GIT", "UI_UX", "PLAYWRIGHT", "VUE"]],
  ["MOBILE_DEV", "Lập trình viên Mobile", "IT", ["FLUTTER", "DART", "FIREBASE", "REST_API", "ANDROID", "IOS", "KOTLIN", "SWIFT", "MOBILE_CI_CD", "TESTING", "GIT"]],
  ["QA_ENGINEER", "Kỹ sư kiểm thử", "IT", ["MANUAL_TESTING", "API_TESTING", "AUTOMATION_TESTING", "PLAYWRIGHT", "SELENIUM", "PERFORMANCE_TESTING", "TESTING", "SQL"]],
  ["DEVOPS_ENGINEER", "Kỹ sư DevOps", "IT", ["DOCKER", "KUBERNETES", "CI_CD", "LINUX", "TERRAFORM", "AWS", "PROMETHEUS", "GRAFANA", "GITHUB_ACTIONS", "NGINX", "MONITORING"]],
  ["AI_ENGINEER", "Kỹ sư AI", "IT", ["PYTHON", "LLM", "RAG", "MACHINE_LEARNING", "FASTAPI", "SQL", "DOCKER", "GIT"]],
  ["DATA_ENGINEER", "Kỹ sư dữ liệu", "IT", ["PYTHON", "DATA_ENGINEERING", "SQL", "POSTGRESQL", "MACHINE_LEARNING", "DOCKER", "GIT"]],
  ["BUSINESS_ANALYST", "Chuyên viên phân tích nghiệp vụ", "IT", ["REQUIREMENT_ANALYSIS", "USER_STORY", "STAKEHOLDER_MANAGEMENT", "BPMN", "DOCUMENTATION", "AGILE_SCRUM", "SQL"]],
  ["UI_UX_DESIGNER", "Chuyên viên thiết kế UI/UX", "IT", ["FIGMA", "UI_UX", "PRODUCT_DISCOVERY", "HTML", "CSS", "REQUIREMENT_ANALYSIS"]],
  ["HR_HEAD", "Trưởng phòng Nhân sự", "HR", ["PEOPLE_MANAGEMENT", "LABOR_LAW", "RECRUITMENT", "PAYROLL_CB", "HRIS", "STAKEHOLDER_MANAGEMENT", "TEAM_LEADERSHIP"]],
  ["HR_TA_LEAD", "Trưởng nhóm Tuyển dụng & Đào tạo", "HR", ["RECRUITMENT", "INTERVIEWING", "TRAINING_DESIGN", "EMPLOYER_BRANDING", "TEAM_LEADERSHIP", "HRIS"]],
  ["HR_CB_LEAD", "Trưởng nhóm C&B", "HR", ["PAYROLL_CB", "SOCIAL_INSURANCE", "LABOR_LAW", "EXCEL", "HRIS", "TEAM_LEADERSHIP"]],
  ["RECRUITER", "Chuyên viên tuyển dụng", "HR", ["RECRUITMENT", "INTERVIEWING", "EMPLOYER_BRANDING", "HRIS", "EXCEL"]],
  ["TRAINING_SPECIALIST", "Chuyên viên đào tạo", "HR", ["TRAINING_DESIGN", "PRESENTATION", "HRIS", "EXCEL"]],
  ["CB_SPECIALIST", "Chuyên viên C&B", "HR", ["PAYROLL_CB", "SOCIAL_INSURANCE", "EXCEL", "LABOR_LAW", "HRIS"]],
  ["FIN_HEAD", "Kế toán trưởng", "FIN", ["ACCOUNTING_VAS", "FINANCIAL_REPORTING", "TAX", "BUDGETING", "COST_CONTROL", "PEOPLE_MANAGEMENT", "RISK_MANAGEMENT"]],
  ["FIN_GL_LEAD", "Trưởng nhóm Kế toán tổng hợp", "FIN", ["ACCOUNTING_VAS", "FINANCIAL_REPORTING", "MISA", "TAX", "EXCEL", "TEAM_LEADERSHIP"]],
  ["ACCOUNTANT", "Kế toán viên", "FIN", ["ACCOUNTING_VAS", "MISA", "EXCEL", "TAX"]],
  ["TAX_ACCOUNTANT", "Kế toán thuế", "FIN", ["TAX", "ACCOUNTING_VAS", "FINANCIAL_REPORTING", "MISA", "EXCEL"]],
  ["SALES_HEAD", "Trưởng phòng Kinh doanh", "SALES", ["B2B_SALES", "NEGOTIATION", "ACCOUNT_MANAGEMENT", "CRM", "MARKET_RESEARCH", "PEOPLE_MANAGEMENT", "STAKEHOLDER_MANAGEMENT"]],
  ["SALES_LEAD", "Trưởng nhóm Kinh doanh", "SALES", ["B2B_SALES", "NEGOTIATION", "CRM", "ACCOUNT_MANAGEMENT", "PRESENTATION", "TEAM_LEADERSHIP"]],
  ["SALES_EXECUTIVE", "Chuyên viên kinh doanh", "SALES", ["B2B_SALES", "NEGOTIATION", "CRM", "MARKET_RESEARCH", "PRESENTATION"]],
  ["PRESALES", "Chuyên viên tư vấn giải pháp", "SALES", ["PRESALES_SOLUTION", "PRESENTATION", "REQUIREMENT_ANALYSIS", "CRM", "DOCUMENTATION"]],
  ["ACCOUNT_EXECUTIVE", "Chuyên viên chăm sóc khách hàng doanh nghiệp", "SALES", ["ACCOUNT_MANAGEMENT", "CUSTOMER_SERVICE", "CRM", "NEGOTIATION"]],
  ["OPS_HEAD", "Trưởng phòng Hành chính - Vận hành", "OPS", ["VENDOR_MANAGEMENT", "PROCUREMENT", "OFFICE_ADMIN", "ASSET_MANAGEMENT", "COST_CONTROL", "PEOPLE_MANAGEMENT"]],
  ["OPS_LEAD", "Trưởng nhóm Hỗ trợ vận hành", "OPS", ["OFFICE_ADMIN", "ASSET_MANAGEMENT", "VENDOR_MANAGEMENT", "CUSTOMER_SERVICE", "TEAM_LEADERSHIP"]],
  ["ADMIN_OFFICER", "Chuyên viên hành chính", "OPS", ["OFFICE_ADMIN", "ASSET_MANAGEMENT", "EXCEL", "M365"]],
  ["PROCUREMENT_OFFICER", "Chuyên viên mua hàng", "OPS", ["PROCUREMENT", "VENDOR_MANAGEMENT", "NEGOTIATION", "COST_CONTROL", "EXCEL"]],
  ["CUSTOMER_SUPPORT", "Chuyên viên hỗ trợ khách hàng", "OPS", ["CUSTOMER_SERVICE", "CRM", "HELPDESK", "M365"]]
];

type PersonSeed = {
  code: string;
  fullName: string;
  position: string;
  level: CareerLevel;
  birthDate: string;
  hireDate: string;
  /** Overrides the default "first N position skills" pick. */
  skills?: string[];
  /** Left the company on this date: inactive account, ended memberships. */
  terminatedOn?: string;
};

type TeamSeed = {
  code: string;
  name: string;
  description: string;
  lead: PersonSeed;
  members: PersonSeed[];
};

type DepartmentSeed = {
  code: DepartmentCode;
  head: PersonSeed;
  teams: TeamSeed[];
};

const { INTERN, FRESHER, JUNIOR, MIDDLE, SENIOR, LEAD } = CareerLevel;

function person(
  code: string,
  fullName: string,
  position: string,
  level: CareerLevel,
  birthDate: string,
  hireDate: string,
  extra: Pick<PersonSeed, "skills" | "terminatedOn"> = {}
): PersonSeed {
  return { code, fullName, position, level, birthDate, hireDate, ...extra };
}

const organization: DepartmentSeed[] = [
  {
    code: "IT",
    head: person("IT001", "Nguyễn Hoàng Minh", "IT_HEAD", LEAD, "1984-05-14", "2018-03-05"),
    teams: [
      {
        code: "IT-BE",
        name: "Nhóm Backend",
        description: "Phát triển API, cơ sở dữ liệu và tích hợp hệ thống cho web, mobile và AI.",
        lead: person("IT002", "Vũ Anh Tuấn", "IT_TECH_LEAD", LEAD, "1989-08-21", "2019-06-10", {
          skills: ["NESTJS", "NODEJS", "POSTGRESQL", "SYSTEM_DESIGN", "CODE_REVIEW", "TEAM_LEADERSHIP"]
        }),
        members: [
          person("IT003", "Lê Bảo Ngọc", "BE_DEV", SENIOR, "1993-09-08", "2020-09-14", {
            skills: ["NESTJS", "POSTGRESQL", "PRISMA", "TYPESCRIPT", "REDIS", "TESTING"]
          }),
          person("IT004", "Trần Đức Thắng", "BE_DEV", MIDDLE, "1996-02-17", "2022-03-07", {
            skills: ["NESTJS", "REST_API", "REDIS", "TYPESCRIPT", "POSTGRESQL"]
          }),
          person("IT005", "Phạm Quang Huy", "BE_DEV", JUNIOR, "1999-11-02", "2024-02-19", {
            skills: ["NESTJS", "TYPESCRIPT", "TESTING", "GIT"]
          }),
          person("IT006", "Đặng Thu Hà", "BE_DEV", FRESHER, "2002-04-25", "2025-07-01", {
            skills: ["NODEJS", "TYPESCRIPT", "REST_API"]
          }),
          person("IT022", "Đinh Công Hậu", "BE_DEV", SENIOR, "1992-10-13", "2020-05-18", {
            skills: ["NODEJS", "MICROSERVICES", "RABBITMQ", "POSTGRESQL", "DOCKER", "NESTJS"]
          }),
          person("IT023", "Mạc Văn Thịnh", "BE_DEV", MIDDLE, "1996-06-02", "2022-10-03", {
            skills: ["NESTJS", "PRISMA", "POSTGRESQL", "REDIS", "TESTING"]
          }),
          person("IT024", "Kiều Anh Dũng", "BE_DEV", MIDDLE, "1995-01-23", "2023-03-13", {
            skills: ["NODEJS", "MYSQL", "REST_API", "TYPESCRIPT", "RABBITMQ"]
          }),
          person("IT025", "Lưu Hồng Nhung", "BE_DEV", JUNIOR, "2000-09-17", "2024-11-04", {
            skills: ["NESTJS", "TYPESCRIPT", "POSTGRESQL", "GIT"]
          })
        ]
      },
      {
        code: "IT-WEB",
        name: "Nhóm Web",
        description: "Phát triển ứng dụng web quản trị, cổng thông tin và website công ty.",
        lead: person("IT007", "Trần Quỳnh Anh", "IT_TECH_LEAD", LEAD, "1990-12-03", "2019-11-18", {
          skills: ["REACT", "NEXTJS", "TYPESCRIPT", "DESIGN_PATTERNS", "CODE_REVIEW", "TEAM_LEADERSHIP"]
        }),
        members: [
          person("IT008", "Trần Anh Khoa", "FE_DEV", SENIOR, "1994-06-20", "2021-04-01", {
            skills: ["REACT", "TYPESCRIPT", "NEXTJS", "TAILWIND", "CSS", "TESTING"]
          }),
          person("IT009", "Ngô Minh Châu", "FE_DEV", MIDDLE, "1997-03-11", "2022-08-15", {
            skills: ["REACT", "JAVASCRIPT", "CSS", "NEXTJS", "HTML"]
          }),
          person("IT010", "Bùi Gia Linh", "FE_DEV", INTERN, "2004-01-30", "2026-08-03", {
            skills: ["JAVASCRIPT", "HTML"]
          }),
          person("IT026", "Tô Minh Hiếu", "FE_DEV", SENIOR, "1993-04-09", "2020-07-20", {
            skills: ["REACT", "NEXTJS", "TYPESCRIPT", "TESTING", "PLAYWRIGHT", "CSS"]
          }),
          person("IT027", "Lê Thu Uyên", "FE_DEV", MIDDLE, "1997-08-24", "2023-01-09", {
            skills: ["REACT", "TYPESCRIPT", "TAILWIND", "CSS", "HTML"]
          }),
          person("IT028", "Phùng Khánh Ngân", "FE_DEV", MIDDLE, "1996-11-30", "2022-12-12", {
            skills: ["VUE", "JAVASCRIPT", "REACT", "CSS", "UI_UX"]
          }),
          person("IT029", "Nguyễn Quốc Việt", "FE_DEV", JUNIOR, "2001-02-18", "2025-03-03", {
            skills: ["REACT", "JAVASCRIPT", "HTML", "CSS"]
          })
        ]
      },
      {
        code: "IT-MOBILE",
        name: "Nhóm Mobile",
        description: "Phát triển ứng dụng di động iOS/Android cho nhân viên và khách hàng.",
        lead: person("IT011", "Hoàng Anh Tuấn", "IT_TECH_LEAD", LEAD, "1991-07-07", "2020-02-10", {
          skills: ["FLUTTER", "FIREBASE", "REST_API", "SYSTEM_DESIGN", "CODE_REVIEW", "TEAM_LEADERSHIP"]
        }),
        members: [
          person("IT012", "Đỗ Ngọc Đức", "MOBILE_DEV", SENIOR, "1995-10-19", "2021-09-06", {
            skills: ["FLUTTER", "DART", "FIREBASE", "REST_API", "ANDROID", "MOBILE_CI_CD"]
          }),
          person("IT013", "Lý Thanh Tâm", "MOBILE_DEV", JUNIOR, "2000-05-05", "2024-05-13", {
            skills: ["FLUTTER", "DART", "FIREBASE", "TESTING"]
          }),
          person("IT030", "Trương Gia Huy", "MOBILE_DEV", SENIOR, "1992-12-15", "2020-09-01", {
            skills: ["IOS", "SWIFT", "FLUTTER", "MOBILE_CI_CD", "FIREBASE", "REST_API"]
          }),
          person("IT031", "Đoàn Mỹ Linh", "MOBILE_DEV", MIDDLE, "1996-03-21", "2022-06-06", {
            skills: ["ANDROID", "KOTLIN", "FLUTTER", "DART", "FIREBASE"]
          }),
          person("IT032", "Bạch Minh Tuấn", "MOBILE_DEV", MIDDLE, "1997-07-12", "2023-02-20", {
            skills: ["FLUTTER", "DART", "REST_API", "TESTING", "GIT"]
          }),
          person("IT033", "Quách Thảo Vy", "MOBILE_DEV", JUNIOR, "2001-10-05", "2025-01-13", {
            skills: ["FLUTTER", "DART", "FIREBASE", "GIT"]
          }),
          person("IT034", "Hồ Đăng Khoa", "MOBILE_DEV", INTERN, "2004-05-27", "2026-07-06", {
            skills: ["FLUTTER", "DART"]
          })
        ]
      },
      {
        code: "IT-QA",
        name: "Nhóm Kiểm thử (QA)",
        description: "Đảm bảo chất lượng phần mềm trước mỗi lần phát hành.",
        lead: person("IT014", "Võ Thị Thanh Nhàn", "IT_QA_LEAD", LEAD, "1990-03-28", "2020-06-01"),
        members: [
          person("IT015", "Phạm Gia Hân", "QA_ENGINEER", MIDDLE, "1997-12-03", "2022-02-07", {
            skills: ["MANUAL_TESTING", "API_TESTING", "PLAYWRIGHT", "SQL", "TESTING"]
          }),
          person("IT016", "Nguyễn Văn Lực", "QA_ENGINEER", JUNIOR, "2000-08-14", "2024-09-09", {
            skills: ["MANUAL_TESTING", "PLAYWRIGHT", "AUTOMATION_TESTING", "TESTING"]
          }),
          person("IT035", "Lâm Ngọc Trâm", "QA_ENGINEER", SENIOR, "1992-02-08", "2020-04-13", {
            skills: ["AUTOMATION_TESTING", "PLAYWRIGHT", "PERFORMANCE_TESTING", "API_TESTING", "SQL", "TESTING"]
          }),
          person("IT036", "Vi Văn Tài", "QA_ENGINEER", MIDDLE, "1996-09-16", "2022-08-01", {
            skills: ["API_TESTING", "SELENIUM", "MANUAL_TESTING", "SQL", "TESTING"]
          }),
          person("IT037", "Nghiêm Thị Hoa", "QA_ENGINEER", JUNIOR, "2000-12-22", "2024-08-19", {
            skills: ["MANUAL_TESTING", "API_TESTING", "TESTING", "SQL"]
          }),
          person("IT038", "Châu Minh Đạt", "QA_ENGINEER", FRESHER, "2003-03-14", "2025-10-06", {
            skills: ["MANUAL_TESTING", "TESTING", "SQL"]
          })
        ]
      },
      {
        code: "IT-DEVOPS",
        name: "Nhóm DevOps & Hạ tầng",
        description: "Vận hành hạ tầng, CI/CD, giám sát và bảo mật hệ thống.",
        lead: person("IT017", "Đặng Quốc Bảo", "IT_TECH_LEAD", LEAD, "1988-01-22", "2019-04-15", {
          skills: ["DOCKER", "KUBERNETES", "CI_CD", "TERRAFORM", "AWS", "LINUX", "TEAM_LEADERSHIP"]
        }),
        members: [
          person("IT018", "Bùi Hải Long", "DEVOPS_ENGINEER", SENIOR, "1993-05-30", "2021-01-11", {
            skills: ["DOCKER", "KUBERNETES", "PROMETHEUS", "GRAFANA", "LINUX", "CI_CD"]
          }),
          person("IT039", "Âu Dương Phong", "DEVOPS_ENGINEER", SENIOR, "1991-08-03", "2020-11-16", {
            skills: ["TERRAFORM", "AWS", "KUBERNETES", "LINUX", "NGINX", "CI_CD"]
          }),
          person("IT040", "Tăng Hữu Nghĩa", "DEVOPS_ENGINEER", MIDDLE, "1995-05-19", "2022-09-12", {
            skills: ["DOCKER", "GITHUB_ACTIONS", "CI_CD", "LINUX", "MONITORING"]
          }),
          person("IT041", "Mai Xuân Trường", "DEVOPS_ENGINEER", MIDDLE, "1994-10-28", "2023-04-03", {
            skills: ["LINUX", "NGINX", "PROMETHEUS", "GRAFANA", "DOCKER"]
          }),
          person("IT042", "Khúc Thị Bích", "DEVOPS_ENGINEER", JUNIOR, "2000-04-11", "2024-12-02", {
            skills: ["DOCKER", "LINUX", "CI_CD", "GITHUB_ACTIONS"]
          })
        ]
      },
      {
        code: "IT-PRODUCT",
        name: "Nhóm Sản phẩm & Thiết kế",
        description: "Phân tích nghiệp vụ, đặc tả yêu cầu và thiết kế trải nghiệm.",
        lead: person("IT019", "Phạm Hồng Sơn", "IT_PRODUCT_LEAD", LEAD, "1989-09-09", "2020-10-05"),
        members: [
          person("IT020", "Nguyễn Mai Phương", "BUSINESS_ANALYST", MIDDLE, "1995-11-11", "2022-05-16"),
          person("IT021", "Trịnh Khánh Vy", "UI_UX_DESIGNER", MIDDLE, "1996-07-27", "2022-11-21"),
          person("IT043", "Giang Thu Thủy", "BUSINESS_ANALYST", SENIOR, "1991-06-26", "2020-08-10"),
          person("IT044", "Ông Hoàng Nam", "UI_UX_DESIGNER", JUNIOR, "2000-11-08", "2024-07-15"),
          person("IT045", "Lạc Bảo Trân", "BUSINESS_ANALYST", JUNIOR, "2001-01-29", "2025-05-19")
        ]
      },
      {
        code: "IT-AI",
        name: "Nhóm Dữ liệu & AI",
        description: "Chatbot HRGenie, gợi ý phân công bằng AI và phân tích dữ liệu nhân sự.",
        lead: person("IT046", "Lê Minh Quang", "IT_TECH_LEAD", LEAD, "1988-12-01", "2019-08-05", {
          skills: ["PYTHON", "LLM", "RAG", "MACHINE_LEARNING", "SYSTEM_DESIGN", "TEAM_LEADERSHIP"]
        }),
        members: [
          person("IT047", "Nguyễn Thanh Hải", "AI_ENGINEER", SENIOR, "1992-07-15", "2021-03-22", {
            skills: ["LLM", "RAG", "PYTHON", "FASTAPI", "MACHINE_LEARNING", "DOCKER"]
          }),
          person("IT048", "Trần Bảo Châu", "AI_ENGINEER", MIDDLE, "1997-01-04", "2023-06-12", {
            skills: ["PYTHON", "MACHINE_LEARNING", "LLM", "FASTAPI", "SQL"]
          }),
          person("IT049", "Phan Đức Mạnh", "DATA_ENGINEER", MIDDLE, "1995-09-09", "2022-11-07", {
            skills: ["DATA_ENGINEERING", "PYTHON", "SQL", "POSTGRESQL", "DOCKER"]
          }),
          person("IT050", "Vũ Ngọc Ánh", "DATA_ENGINEER", JUNIOR, "2000-06-20", "2024-10-21", {
            skills: ["PYTHON", "SQL", "DATA_ENGINEERING", "GIT"]
          }),
          person("IT051", "Hà Tuấn Kiệt", "AI_ENGINEER", FRESHER, "2003-02-25", "2026-03-02", {
            skills: ["PYTHON", "LLM", "GIT"]
          })
        ]
      }
    ]
  },
  {
    code: "HR",
    head: person("HR001", "Vũ Thanh Hằng", "HR_HEAD", LEAD, "1985-04-18", "2018-08-01"),
    teams: [
      {
        code: "HR-TA",
        name: "Nhóm Tuyển dụng & Đào tạo",
        description: "Tuyển dụng, hội nhập và đào tạo nhân sự.",
        lead: person("HR002", "Nguyễn Thùy Dương", "HR_TA_LEAD", LEAD, "1990-07-22", "2020-05-11"),
        members: [
          person("HR003", "Trần Quốc Bảo", "RECRUITER", MIDDLE, "1995-02-14", "2022-09-05"),
          person("HR004", "Hoàng Minh Thư", "RECRUITER", JUNIOR, "1999-12-01", "2024-03-18"),
          person("HR005", "Đặng Khánh Linh", "TRAINING_SPECIALIST", MIDDLE, "1994-03-26", "2021-11-15")
        ]
      },
      {
        code: "HR-CB",
        name: "Nhóm C&B",
        description: "Lương, thưởng, phúc lợi và bảo hiểm cho người lao động.",
        lead: person("HR006", "Lê Hoàng Yến", "HR_CB_LEAD", LEAD, "1989-10-30", "2019-07-15"),
        members: [
          person("HR007", "Phạm Đức Duy", "CB_SPECIALIST", MIDDLE, "1996-05-09", "2022-06-20"),
          person("HR008", "Ngô Phương Anh", "CB_SPECIALIST", FRESHER, "2002-06-11", "2025-09-03")
        ]
      }
    ]
  },
  {
    code: "FIN",
    head: person("FIN001", "Trương Thị Lan", "FIN_HEAD", LEAD, "1983-02-12", "2017-10-02"),
    teams: [
      {
        code: "FIN-GL",
        name: "Nhóm Kế toán tổng hợp",
        description: "Ghi sổ, khóa sổ, công nợ và kê khai thuế.",
        lead: person("FIN002", "Đinh Văn Khải", "FIN_GL_LEAD", LEAD, "1988-11-08", "2019-03-04"),
        members: [
          person("FIN003", "Mai Ngọc Diệp", "ACCOUNTANT", MIDDLE, "1995-08-19", "2021-08-09"),
          person("FIN004", "Cao Minh Nhật", "ACCOUNTANT", JUNIOR, "1999-04-07", "2023-10-02"),
          person("FIN005", "Hồ Thanh Tú", "TAX_ACCOUNTANT", SENIOR, "1991-01-16", "2020-12-07")
        ]
      }
    ]
  },
  {
    code: "SALES",
    head: person("SAL001", "Đoàn Chí Thành", "SALES_HEAD", LEAD, "1982-11-04", "2017-05-02"),
    teams: [
      {
        code: "SAL-HN",
        name: "Nhóm Kinh doanh Hà Nội",
        description: "Phát triển khách hàng doanh nghiệp khu vực phía Bắc.",
        lead: person("SAL002", "Nguyễn Tiến Dũng", "SALES_LEAD", LEAD, "1988-06-28", "2019-02-18"),
        members: [
          person("SAL003", "Lương Bá Đạt", "SALES_EXECUTIVE", SENIOR, "1992-05-25", "2020-08-24"),
          person("SAL004", "Chu Thị Hạnh", "SALES_EXECUTIVE", JUNIOR, "1999-09-02", "2023-12-04"),
          person("SAL005", "Tống Gia Hưng", "PRESALES", MIDDLE, "1996-12-19", "2022-04-11"),
          person("SAL006", "Phan Văn Toàn", "SALES_EXECUTIVE", MIDDLE, "1994-03-03", "2021-06-14", {
            terminatedOn: "2026-07-31"
          })
        ]
      },
      {
        code: "SAL-HCM",
        name: "Nhóm Kinh doanh Hồ Chí Minh",
        description: "Phát triển khách hàng doanh nghiệp khu vực phía Nam.",
        lead: person("SAL007", "Lý Thu Trang", "SALES_LEAD", LEAD, "1990-01-19", "2020-03-09"),
        members: [
          person("SAL008", "Dương Gia Bảo", "SALES_EXECUTIVE", MIDDLE, "1996-12-27", "2022-07-25"),
          person("SAL009", "Tạ Hữu Phước", "ACCOUNT_EXECUTIVE", JUNIOR, "2001-05-21", "2024-06-03"),
          person("SAL010", "Nguyễn Hải Yến", "ACCOUNT_EXECUTIVE", SENIOR, "1990-03-05", "2020-02-17")
        ]
      }
    ]
  },
  {
    code: "OPS",
    head: person("OPS001", "Trương Văn Hùng", "OPS_HEAD", LEAD, "1984-09-25", "2018-06-11"),
    teams: [
      {
        code: "OPS-SUP",
        name: "Nhóm Hỗ trợ vận hành",
        description: "Hành chính văn phòng, mua sắm, tài sản và hỗ trợ khách hàng.",
        lead: person("OPS002", "Vương Đình Trung", "OPS_LEAD", LEAD, "1989-06-16", "2019-09-09"),
        members: [
          person("OPS003", "Phan Thanh Bình", "ADMIN_OFFICER", MIDDLE, "1995-07-30", "2021-12-06"),
          person("OPS004", "Đỗ Quỳnh Như", "ADMIN_OFFICER", JUNIOR, "1998-12-06", "2023-09-18"),
          person("OPS005", "Hoàng Thùy Chi", "PROCUREMENT_OFFICER", SENIOR, "1991-10-12", "2020-11-02"),
          person("OPS006", "Lê Nhật Minh", "CUSTOMER_SUPPORT", JUNIOR, "2000-01-31", "2024-10-07")
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Projects and tasks (dates are workday offsets from today)
// ---------------------------------------------------------------------------

const { BEGINNER: BEG, INTERMEDIATE: INT, ADVANCED: ADV } = SkillProficiency;
const { REQUIRED: REQ, IMPORTANT: IMP, NICE_TO_HAVE: NICE } = TaskSkillImportance;

type SubtaskSeed = {
  title: string;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  actualHours?: number;
  start: number;
  due: number;
  skills: Array<[string, SkillProficiency, TaskSkillImportance]>;
};

type TeamTaskSeed = {
  team: string;
  title: string;
  description: string;
  technologies: string[];
  subtasks: SubtaskSeed[];
};

type ProjectSeed = {
  code: string;
  name: string;
  description: string;
  department: DepartmentCode;
  status: ProjectStatus;
  start: number;
  end: number;
  tasks: TeamTaskSeed[];
};

const { TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED } = TaskStatus;
const { LOW, MEDIUM, HIGH, URGENT } = TaskPriority;

const projects: ProjectSeed[] = [
  {
    code: "OMNIHR-V2",
    name: "[Web] Nâng cấp nền tảng OmniHR v2",
    description: "Bổ sung module bảng lương, phiếu lương và kiểm thử hồi quy toàn hệ thống.",
    department: "IT",
    status: ProjectStatus.ACTIVE,
    start: -55,
    end: 45,
    tasks: [
      {
        team: "IT-BE",
        title: "Xây dựng module Bảng lương & Phiếu lương",
        description: "API tính lương từ bảng công, chốt kỳ lương và gửi phiếu lương cho nhân viên.",
        technologies: ["NestJS", "Prisma", "PostgreSQL", "Redis"],
        subtasks: [
          { title: "Thiết kế schema kỳ lương và phiếu lương", assignee: "IT003", status: DONE, priority: HIGH, estimatedHours: 16, actualHours: 18, start: -34, due: -27, skills: [["POSTGRESQL", ADV, REQ], ["PRISMA", INT, IMP]] },
          { title: "API tính lương theo bảng công tháng", assignee: "IT003", status: IN_REVIEW, priority: URGENT, estimatedHours: 32, actualHours: 30, start: -26, due: 2, skills: [["NESTJS", ADV, REQ], ["POSTGRESQL", INT, IMP], ["TESTING", INT, NICE]] },
          { title: "Gửi phiếu lương qua email hàng loạt", assignee: "IT004", status: IN_PROGRESS, priority: HIGH, estimatedHours: 20, actualHours: 9, start: -7, due: 8, skills: [["NESTJS", INT, REQ], ["REDIS", INT, IMP]] },
          { title: "Viết unit test cho luồng chốt bảng lương", assignee: "IT005", status: TODO, priority: MEDIUM, estimatedHours: 12, start: 1, due: 12, skills: [["TESTING", INT, REQ], ["TYPESCRIPT", INT, IMP]] },
          { title: "Tối ưu truy vấn báo cáo tổng hợp lương", assignee: null, status: TODO, priority: MEDIUM, estimatedHours: 10, start: 3, due: 15, skills: [["POSTGRESQL", ADV, REQ], ["PRISMA", INT, IMP]] }
        ]
      },
      {
        team: "IT-WEB",
        title: "Giao diện quản trị bảng lương",
        description: "Màn hình kỳ lương, chi tiết phiếu lương và phân quyền cho Kế toán.",
        technologies: ["React", "TypeScript", "Mantine", "TanStack Query"],
        subtasks: [
          { title: "Màn danh sách kỳ lương và bộ lọc", assignee: "IT008", status: DONE, priority: HIGH, estimatedHours: 14, actualHours: 15, start: -22, due: -13, skills: [["REACT", ADV, REQ], ["TYPESCRIPT", INT, IMP]] },
          { title: "Màn chi tiết phiếu lương và xuất PDF", assignee: "IT009", status: IN_PROGRESS, priority: HIGH, estimatedHours: 18, actualHours: 8, start: -9, due: 6, skills: [["REACT", INT, REQ], ["CSS", INT, IMP]] },
          { title: "Ẩn/hiện chức năng bảng lương theo vai trò Kế toán", assignee: "IT008", status: TODO, priority: MEDIUM, estimatedHours: 8, start: 1, due: 10, skills: [["REACT", ADV, REQ], ["TYPESCRIPT", ADV, IMP]] },
          { title: "Viết test giao diện màn kỳ lương", assignee: "IT010", status: TODO, priority: LOW, estimatedHours: 10, start: 2, due: 18, skills: [["JAVASCRIPT", BEG, REQ], ["TESTING", BEG, NICE]] }
        ]
      },
      {
        team: "IT-QA",
        title: "Kiểm thử hồi quy phiên bản v2.0",
        description: "Kiểm thử chấm công, nghỉ phép, phân quyền và hiệu năng trước khi phát hành.",
        technologies: ["Playwright", "Postman", "k6"],
        subtasks: [
          { title: "Viết kịch bản kiểm thử luồng chấm công", assignee: "IT015", status: IN_PROGRESS, priority: HIGH, estimatedHours: 16, actualHours: 6, start: -4, due: 5, skills: [["MANUAL_TESTING", INT, REQ], ["API_TESTING", INT, IMP]] },
          { title: "Tự động hóa kiểm thử đăng nhập và phân quyền", assignee: "IT016", status: TODO, priority: MEDIUM, estimatedHours: 20, start: 2, due: 16, skills: [["PLAYWRIGHT", INT, REQ], ["AUTOMATION_TESTING", INT, IMP]] },
          { title: "Kiểm thử hiệu năng API chấm công giờ cao điểm", assignee: null, status: TODO, priority: HIGH, estimatedHours: 12, start: 6, due: 20, skills: [["PERFORMANCE_TESTING", ADV, REQ], ["API_TESTING", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "CLINIC-APP",
    name: "[Mobile] Ứng dụng đặt lịch khám cho đối tác phòng khám",
    description: "Ứng dụng di động và API đặt lịch khám cho chuỗi phòng khám đối tác.",
    department: "IT",
    status: ProjectStatus.ACTIVE,
    start: -30,
    end: 65,
    tasks: [
      {
        team: "IT-PRODUCT",
        title: "Khảo sát và đặc tả nghiệp vụ phòng khám",
        description: "Làm rõ quy trình đặt lịch, thanh toán và nhắc lịch với phòng khám đối tác.",
        technologies: ["Figma", "Confluence"],
        subtasks: [
          { title: "Phỏng vấn nhu cầu của 3 phòng khám đối tác", assignee: "IT020", status: DONE, priority: HIGH, estimatedHours: 16, actualHours: 18, start: -30, due: -24, skills: [["REQUIREMENT_ANALYSIS", ADV, REQ], ["STAKEHOLDER_MANAGEMENT", INT, IMP]] },
          { title: "Thiết kế wireframe và prototype trên Figma", assignee: "IT021", status: DONE, priority: MEDIUM, estimatedHours: 24, actualHours: 26, start: -25, due: -18, skills: [["FIGMA", ADV, REQ], ["UI_UX", ADV, IMP]] }
        ]
      },
      {
        team: "IT-MOBILE",
        title: "Ứng dụng đặt lịch khám cho bệnh nhân",
        description: "Ứng dụng Flutter cho bệnh nhân đăng ký, chọn bác sĩ và nhận nhắc lịch.",
        technologies: ["Flutter", "Firebase"],
        subtasks: [
          { title: "Màn đăng ký/đăng nhập bằng số điện thoại", assignee: "IT012", status: DONE, priority: HIGH, estimatedHours: 16, actualHours: 14, start: -18, due: -12, skills: [["FLUTTER", ADV, REQ], ["FIREBASE", INT, IMP]] },
          { title: "Luồng chọn bác sĩ và khung giờ khám", assignee: "IT012", status: IN_PROGRESS, priority: URGENT, estimatedHours: 28, actualHours: 20, start: -11, due: -2, skills: [["FLUTTER", ADV, REQ], ["REST_API", INT, IMP]] },
          { title: "Thông báo nhắc lịch khám bằng push notification", assignee: "IT013", status: TODO, priority: MEDIUM, estimatedHours: 12, start: 3, due: 14, skills: [["FIREBASE", INT, REQ], ["DART", INT, IMP]] }
        ]
      },
      {
        team: "IT-BE",
        title: "API đặt lịch và quản lý phòng khám",
        description: "API lịch làm việc bác sĩ, đặt lịch, chống trùng lịch và thanh toán.",
        technologies: ["NestJS", "PostgreSQL", "Docker"],
        subtasks: [
          { title: "Thiết kế API lịch làm việc của bác sĩ", assignee: "IT004", status: DONE, priority: HIGH, estimatedHours: 12, actualHours: 13, start: -20, due: -14, skills: [["REST_API", INT, REQ], ["NESTJS", INT, IMP]] },
          { title: "Xử lý trùng lịch khi nhiều bệnh nhân đặt cùng lúc", assignee: "IT003", status: IN_PROGRESS, priority: URGENT, estimatedHours: 18, actualHours: 7, start: -5, due: 4, skills: [["POSTGRESQL", ADV, REQ], ["NESTJS", ADV, IMP]] },
          { title: "Tích hợp cổng thanh toán VNPay", assignee: null, status: TODO, priority: HIGH, estimatedHours: 24, start: 5, due: 22, skills: [["NESTJS", ADV, REQ], ["REST_API", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "INFRA-2026",
    name: "[DevOps] Chuẩn hóa hạ tầng và giám sát hệ thống",
    description: "Chuyển môi trường staging lên Kubernetes và thiết lập giám sát tập trung.",
    department: "IT",
    status: ProjectStatus.PLANNING,
    start: 10,
    end: 80,
    tasks: [
      {
        team: "IT-DEVOPS",
        title: "Chuyển hạ tầng staging lên Kubernetes",
        description: "Hạ tầng dưới dạng mã, triển khai tự động và giám sát cho môi trường staging.",
        technologies: ["Kubernetes", "Terraform", "GitHub Actions"],
        subtasks: [
          { title: "Viết Terraform cho cụm staging", assignee: null, status: TODO, priority: HIGH, estimatedHours: 20, start: 10, due: 22, skills: [["TERRAFORM", ADV, REQ], ["AWS", INT, IMP]] },
          { title: "Thiết lập giám sát Prometheus và Grafana", assignee: "IT018", status: TODO, priority: MEDIUM, estimatedHours: 16, start: 15, due: 30, skills: [["PROMETHEUS", INT, REQ], ["GRAFANA", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "WEB-REVAMP",
    name: "[Web] Làm mới website công ty",
    description: "Thiết kế lại website giới thiệu và trang tuyển dụng.",
    department: "IT",
    status: ProjectStatus.COMPLETED,
    start: -130,
    end: -45,
    tasks: [
      {
        team: "IT-WEB",
        title: "Làm mới giao diện website công ty",
        description: "Dựng lại trang chủ, trang tuyển dụng và tối ưu SEO.",
        technologies: ["Next.js", "Tailwind CSS"],
        subtasks: [
          { title: "Dựng trang chủ và trang tuyển dụng", assignee: "IT008", status: DONE, priority: HIGH, estimatedHours: 30, actualHours: 32, start: -125, due: -95, skills: [["NEXTJS", ADV, REQ], ["TAILWIND", INT, IMP]] },
          { title: "Tối ưu SEO và tốc độ tải trang", assignee: "IT009", status: DONE, priority: MEDIUM, estimatedHours: 12, actualHours: 10, start: -90, due: -50, skills: [["NEXTJS", INT, REQ], ["JAVASCRIPT", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "HRGENIE-AI",
    name: "[AI] Trợ lý ảo HRGenie cho nhân viên",
    description: "Chatbot trả lời chính sách nhân sự, tra cứu ngày phép và tạo đơn nghỉ qua hội thoại.",
    department: "IT",
    status: ProjectStatus.ACTIVE,
    start: -25,
    end: 45,
    tasks: [
      {
        team: "IT-AI",
        title: "Mô hình hội thoại và tra cứu chính sách",
        description: "RAG trên tài liệu chính sách nhân sự và bộ lập kế hoạch gọi công cụ cho HRGenie.",
        technologies: ["Python", "FastAPI", "LLM", "RAG"],
        subtasks: [
          { title: "Chuẩn hóa và chia đoạn bộ tài liệu chính sách nhân sự", assignee: "IT049", status: DONE, priority: HIGH, estimatedHours: 16, actualHours: 15, start: -25, due: -18, skills: [["DATA_ENGINEERING", INT, REQ], ["PYTHON", INT, IMP]] },
          { title: "Xây dựng pipeline RAG tra cứu chính sách", assignee: "IT047", status: DONE, priority: URGENT, estimatedHours: 24, actualHours: 22, start: -17, due: -8, skills: [["RAG", ADV, REQ], ["LLM", ADV, IMP]] },
          { title: "Bộ lập kế hoạch gọi công cụ tạo đơn nghỉ phép", assignee: "IT048", status: IN_PROGRESS, priority: HIGH, estimatedHours: 20, actualHours: 9, start: -6, due: 6, skills: [["LLM", INT, REQ], ["FASTAPI", INT, IMP]] },
          { title: "Bộ câu hỏi đánh giá độ chính xác của chatbot", assignee: "IT051", status: TODO, priority: MEDIUM, estimatedHours: 12, start: 2, due: 12, skills: [["PYTHON", BEG, REQ], ["LLM", BEG, NICE]] }
        ]
      },
      {
        team: "IT-BE",
        title: "Cổng chatbot trên NestJS",
        description: "Xác thực, phân quyền và thực thi hành động mà HRGenie đề xuất.",
        technologies: ["NestJS", "PostgreSQL"],
        subtasks: [
          { title: "API hội thoại và lưu lịch sử chat", assignee: "IT022", status: DONE, priority: HIGH, estimatedHours: 14, actualHours: 16, start: -20, due: -12, skills: [["NESTJS", ADV, REQ], ["POSTGRESQL", INT, IMP]] },
          { title: "Xác nhận và thực thi hành động chờ duyệt", assignee: "IT023", status: IN_PROGRESS, priority: HIGH, estimatedHours: 16, actualHours: 6, start: -5, due: 7, skills: [["NESTJS", INT, REQ], ["TESTING", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "HR-RECRUIT-Q4",
    name: "Tuyển dụng nhân sự quý IV",
    description: "Tuyển kỹ sư phần mềm cho phòng CNTT và chuẩn hóa chương trình hội nhập.",
    department: "HR",
    status: ProjectStatus.ACTIVE,
    start: -15,
    end: 55,
    tasks: [
      {
        team: "HR-TA",
        title: "Tuyển 6 kỹ sư phần mềm cho phòng CNTT",
        description: "Đăng tin, sàng lọc, phỏng vấn và đón nhân sự mới.",
        technologies: [],
        subtasks: [
          { title: "Đăng tin tuyển dụng trên TopCV và LinkedIn", assignee: "HR004", status: DONE, priority: MEDIUM, estimatedHours: 6, actualHours: 5, start: -15, due: -12, skills: [["RECRUITMENT", INT, REQ], ["EMPLOYER_BRANDING", BEG, NICE]] },
          { title: "Sàng lọc hồ sơ và phỏng vấn vòng 1", assignee: "HR003", status: IN_PROGRESS, priority: HIGH, estimatedHours: 30, actualHours: 14, start: -11, due: 10, skills: [["INTERVIEWING", INT, REQ], ["RECRUITMENT", INT, IMP]] },
          { title: "Xây dựng chương trình hội nhập cho nhân sự mới", assignee: "HR005", status: TODO, priority: MEDIUM, estimatedHours: 16, start: 4, due: 20, skills: [["TRAINING_DESIGN", INT, REQ]] }
        ]
      },
      {
        team: "HR-CB",
        title: "Rà soát chính sách lương thưởng năm tới",
        description: "Khảo sát lương thị trường và cập nhật mức đóng bảo hiểm.",
        technologies: [],
        subtasks: [
          { title: "Khảo sát mặt bằng lương thị trường ngành IT", assignee: "HR007", status: IN_PROGRESS, priority: MEDIUM, estimatedHours: 20, actualHours: 8, start: -8, due: 10, skills: [["PAYROLL_CB", INT, REQ], ["EXCEL", ADV, IMP]] },
          { title: "Cập nhật mức đóng BHXH theo lương tối thiểu vùng mới", assignee: "HR008", status: TODO, priority: HIGH, estimatedHours: 8, start: 0, due: 7, skills: [["SOCIAL_INSURANCE", BEG, REQ], ["LABOR_LAW", BEG, IMP]] }
        ]
      }
    ]
  },
  {
    code: "FIN-CLOSE",
    name: "Chuẩn hóa quy trình khóa sổ tháng",
    description: "Rút ngắn thời gian khóa sổ và đối chiếu công nợ hằng tháng.",
    department: "FIN",
    status: ProjectStatus.ACTIVE,
    start: -20,
    end: 40,
    tasks: [
      {
        team: "FIN-GL",
        title: "Chuẩn hóa quy trình khóa sổ cuối tháng",
        description: "Checklist khóa sổ, đối chiếu công nợ và quyết toán thuế theo quý.",
        technologies: [],
        subtasks: [
          { title: "Lập checklist khóa sổ và phân công", assignee: "FIN003", status: DONE, priority: MEDIUM, estimatedHours: 8, actualHours: 8, start: -20, due: -16, skills: [["ACCOUNTING_VAS", INT, REQ], ["EXCEL", INT, IMP]] },
          { title: "Đối chiếu công nợ nhà cung cấp tháng trước", assignee: "FIN004", status: IN_REVIEW, priority: HIGH, estimatedHours: 12, actualHours: 11, start: -9, due: -1, skills: [["ACCOUNTING_VAS", INT, REQ], ["MISA", INT, IMP]] },
          { title: "Quyết toán thuế TNCN theo quý", assignee: "FIN005", status: TODO, priority: HIGH, estimatedHours: 16, start: 4, due: 20, skills: [["TAX", ADV, REQ], ["FINANCIAL_REPORTING", INT, IMP]] }
        ]
      }
    ]
  },
  {
    code: "SALES-CRM",
    name: "Triển khai quy trình CRM cho phòng Kinh doanh",
    description: "Làm sạch dữ liệu khách hàng và mở rộng tệp khách hàng phía Nam.",
    department: "SALES",
    status: ProjectStatus.ACTIVE,
    start: -18,
    end: 50,
    tasks: [
      {
        team: "SAL-HN",
        title: "Chuẩn hóa dữ liệu khách hàng trên CRM",
        description: "Làm sạch dữ liệu và chuẩn bị tài liệu demo cho khách hàng doanh nghiệp.",
        technologies: [],
        subtasks: [
          { title: "Làm sạch dữ liệu 500 khách hàng doanh nghiệp", assignee: "SAL004", status: IN_PROGRESS, priority: MEDIUM, estimatedHours: 20, actualHours: 12, start: -14, due: 6, skills: [["CRM", INT, REQ]] },
          { title: "Chuẩn bị bộ tài liệu demo giải pháp OmniHR", assignee: "SAL005", status: DONE, priority: HIGH, estimatedHours: 12, actualHours: 14, start: -18, due: -10, skills: [["PRESALES_SOLUTION", INT, REQ], ["PRESENTATION", INT, IMP]] },
          { title: "Chăm sóc nhóm khách hàng khu vực Cầu Giấy", assignee: "SAL006", status: CANCELLED, priority: LOW, estimatedHours: 16, actualHours: 4, start: -18, due: 2, skills: [["B2B_SALES", INT, REQ]] }
        ]
      },
      {
        team: "SAL-HCM",
        title: "Mở rộng tệp khách hàng khu vực phía Nam",
        description: "Tìm kiếm doanh nghiệp tiềm năng và tổ chức hội thảo giới thiệu sản phẩm.",
        technologies: [],
        subtasks: [
          { title: "Lập danh sách 100 doanh nghiệp tiềm năng tại TP.HCM", assignee: "SAL008", status: IN_PROGRESS, priority: HIGH, estimatedHours: 16, actualHours: 6, start: -6, due: 8, skills: [["MARKET_RESEARCH", INT, REQ], ["B2B_SALES", INT, IMP]] },
          { title: "Tổ chức hội thảo giới thiệu sản phẩm", assignee: null, status: TODO, priority: MEDIUM, estimatedHours: 24, start: 8, due: 30, skills: [["PRESENTATION", INT, REQ], ["NEGOTIATION", INT, NICE]] }
        ]
      }
    ]
  },
  {
    code: "OPS-OFFICE",
    name: "Mở rộng văn phòng tầng 12",
    description: "Bố trí thêm chỗ ngồi cho nhân sự mới của phòng CNTT và Kinh doanh.",
    department: "OPS",
    status: ProjectStatus.ACTIVE,
    start: -12,
    end: 30,
    tasks: [
      {
        team: "OPS-SUP",
        title: "Chuẩn bị khu làm việc mới tầng 12",
        description: "Mua sắm nội thất, bàn giao tài sản và cập nhật hợp đồng dịch vụ tòa nhà.",
        technologies: [],
        subtasks: [
          { title: "Lấy báo giá nội thất từ 3 nhà cung cấp", assignee: "OPS005", status: DONE, priority: MEDIUM, estimatedHours: 10, actualHours: 9, start: -12, due: -7, skills: [["PROCUREMENT", ADV, REQ], ["VENDOR_MANAGEMENT", INT, IMP]] },
          { title: "Đăng ký lại hợp đồng vệ sinh và an ninh tòa nhà", assignee: "OPS004", status: IN_PROGRESS, priority: LOW, estimatedHours: 6, actualHours: 2, start: -4, due: 6, skills: [["OFFICE_ADMIN", BEG, REQ]] },
          { title: "Kiểm kê và bàn giao tài sản IT cho khu mới", assignee: "OPS003", status: TODO, priority: MEDIUM, estimatedHours: 12, start: 7, due: 20, skills: [["ASSET_MANAGEMENT", INT, REQ], ["OFFICE_ADMIN", INT, NICE]] }
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Leave requests (dates are workday offsets from today)
// ---------------------------------------------------------------------------

type LeaveSeed = {
  employee: string;
  type: (typeof leaveTypes)[number][0];
  start: number;
  end: number;
  reason: string;
  status: LeaveRequestStatus;
  rejectionReason?: string;
};

const { APPROVED, PENDING, REJECTED, CANCELLED: LEAVE_CANCELLED } = LeaveRequestStatus;

const leaveRequests: LeaveSeed[] = [
  { employee: "IT001", type: "ANNUAL_LEAVE", start: -21, end: -20, reason: "Nghỉ phép cùng gia đình", status: APPROVED },
  { employee: "IT002", type: "ANNUAL_LEAVE", start: -9, end: -9, reason: "Giải quyết thủ tục hành chính cá nhân", status: APPROVED },
  { employee: "IT003", type: "ANNUAL_LEAVE", start: -12, end: -11, reason: "Về quê có việc gia đình", status: APPROVED },
  { employee: "IT008", type: "ANNUAL_LEAVE", start: -8, end: -8, reason: "Khám sức khỏe định kỳ", status: APPROVED },
  { employee: "IT015", type: "ANNUAL_LEAVE", start: -15, end: -14, reason: "Đi du lịch đã lên kế hoạch trước", status: APPROVED },
  { employee: "HR003", type: "SICK_LEAVE", start: -6, end: -6, reason: "Sốt cao, có giấy khám bệnh", status: APPROVED },
  { employee: "FIN005", type: "MARRIAGE_LEAVE", start: -19, end: -17, reason: "Nghỉ cưới", status: APPROVED },
  { employee: "SAL003", type: "UNPAID_LEAVE", start: -5, end: -5, reason: "Việc cá nhân đột xuất", status: APPROVED },
  { employee: "SAL008", type: "ANNUAL_LEAVE", start: -18, end: -16, reason: "Du lịch cùng gia đình", status: APPROVED },
  { employee: "OPS005", type: "ANNUAL_LEAVE", start: -3, end: -3, reason: "Đưa người thân đi khám bệnh", status: APPROVED },
  { employee: "IT004", type: "ANNUAL_LEAVE", start: 4, end: 5, reason: "Đưa con đi nhập học", status: PENDING },
  { employee: "IT007", type: "ANNUAL_LEAVE", start: 8, end: 9, reason: "Nghỉ phép cá nhân", status: PENDING },
  { employee: "IT012", type: "ANNUAL_LEAVE", start: 7, end: 7, reason: "Việc gia đình", status: PENDING },
  { employee: "IT018", type: "ANNUAL_LEAVE", start: 3, end: 3, reason: "Làm thủ tục mua nhà", status: PENDING },
  { employee: "HR007", type: "ANNUAL_LEAVE", start: 10, end: 12, reason: "Nghỉ phép du lịch", status: PENDING },
  { employee: "SAL004", type: "SICK_LEAVE", start: 2, end: 2, reason: "Tái khám theo lịch hẹn của bác sĩ", status: PENDING },
  {
    employee: "IT009",
    type: "ANNUAL_LEAVE",
    start: 1,
    end: 3,
    reason: "Nghỉ phép cá nhân",
    status: REJECTED,
    rejectionReason: "Trùng giai đoạn bàn giao màn chi tiết phiếu lương, bạn vui lòng chọn tuần sau nhé."
  },
  {
    employee: "OPS006",
    type: "ANNUAL_LEAVE",
    start: -10,
    end: -9,
    reason: "Nghỉ phép cá nhân",
    status: REJECTED,
    rejectionReason: "Hai ngày này nhóm thiếu người trực hỗ trợ khách hàng."
  },
  { employee: "HR004", type: "ANNUAL_LEAVE", start: 6, end: 6, reason: "Tham dự đám cưới bạn thân", status: LEAVE_CANCELLED }
];

// ---------------------------------------------------------------------------
// Dates, randomness, helpers
// ---------------------------------------------------------------------------

const TZ_OFFSET_MINUTES = 420;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/**
 * The whole seeded timeline hangs off this date: attendance, leave, task and
 * login dates are all offsets from it. `SEED_AS_OF=YYYY-MM-DD` moves the
 * anchor into the past so prisma/simulate-day.ts can then play the history
 * forward from there to today, which is what fills a dataset with months of
 * day-by-day activity instead of one snapshot. It is never allowed to sit in
 * the future: a seeded database must not contain a day that has not happened.
 */
const NOW = seedAnchor();
const TODAY = companyToday(NOW);

function seedAnchor() {
  const now = new Date();
  const raw = process.env.SEED_AS_OF;
  if (!raw) {
    return now;
  }
  const asOf = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("SEED_AS_OF expects a date in YYYY-MM-DD format");
  }
  if (asOf > now) {
    throw new Error("SEED_AS_OF cannot be in the future");
  }
  return asOf;
}
const TEAMS_FORMED_ON = dateOnly("2025-01-06");
const OFFICE = { latitude: 21.0227, longitude: 105.8466 };
const SHIFTS = [
  { shift: AttendanceShift.MORNING, start: 8 * 60, end: 12 * 60 },
  { shift: AttendanceShift.AFTERNOON, start: 13 * 60, end: 17 * 60 }
];
const EARLY_CHECK_IN_MINUTES = 60;

const random = createRandom(20260915);

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function unique<T>(items: readonly T[]) {
  return Array.from(new Set(items));
}

function companyToday(now: Date) {
  const local = new Date(now.getTime() + TZ_OFFSET_MINUTES * MINUTE_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * First day of the anchor's own month. The seed covers that month; everything
 * between it and today is the simulator's job.
 */
function firstOfAnchorMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Every workday in [start, end], oldest first. */
function workdaysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWorkday(day)) {
      days.push(day);
    }
  }
  return days;
}

function isWorkday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Workday `offset` days from today: 0 is today (or the next workday), -1 the previous workday. */
function workday(offset: number) {
  let date = TODAY;
  if (offset === 0) {
    while (!isWorkday(date)) {
      date = addDays(date, 1);
    }
    return date;
  }
  const step = offset > 0 ? 1 : -1;
  let remaining = Math.abs(offset);
  while (remaining > 0) {
    date = addDays(date, step);
    if (isWorkday(date)) {
      remaining -= 1;
    }
  }
  return date;
}

function workdaysInclusive(start: Date, end: Date) {
  let count = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWorkday(day)) {
      count += 1;
    }
  }
  return count;
}

/** A local company time on a work date, as a UTC instant. */
function at(date: Date, minutesAfterMidnight: number) {
  return new Date(date.getTime() + (minutesAfterMidnight - TZ_OFFSET_MINUTES) * MINUTE_MS);
}

function hm(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function notAfterNow(date: Date) {
  return date > NOW ? new Date(NOW.getTime() - MINUTE_MS) : date;
}

function laterOf(a: Date, b: Date) {
  return a > b ? a : b;
}

/** Same rule as `isManagerPosition` in src/common/position-role.ts. */
function isManagerPosition(code: string, name: string) {
  const value = `${code} ${name}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return /\b(manager|lead|leader|head|director|supervisor|truong|quan ly)\b/.test(value);
}

/** "Nguyễn Hoàng Minh" -> "minhnh", the usual Vietnamese company username. */
function usernameFor(fullName: string) {
  const words = fullName
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const given = words[words.length - 1];
  return given + words.slice(0, -1).map((word) => word[0]).join("");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Seed data is inconsistent: ${message}`);
  }
}

const skillCountByLevel: Record<CareerLevel, number> = {
  INTERN: 2,
  FRESHER: 3,
  JUNIOR: 4,
  MIDDLE: 5,
  SENIOR: 6,
  LEAD: 6
};

const yearsByLevel: Record<CareerLevel, number> = {
  INTERN: 0.5,
  FRESHER: 1,
  JUNIOR: 2,
  MIDDLE: 4,
  SENIOR: 6,
  LEAD: 8
};

function proficiencyFor(level: CareerLevel, index: number): SkillProficiency {
  switch (level) {
    case LEAD:
    case SENIOR:
      return index < 2 ? SkillProficiency.EXPERT : SkillProficiency.ADVANCED;
    case MIDDLE:
      return index < 2 ? SkillProficiency.ADVANCED : SkillProficiency.INTERMEDIATE;
    case JUNIOR:
      return index < 2 ? SkillProficiency.INTERMEDIATE : SkillProficiency.BEGINNER;
    case FRESHER:
      return index < 1 ? SkillProficiency.INTERMEDIATE : SkillProficiency.BEGINNER;
    default:
      return SkillProficiency.BEGINNER;
  }
}


// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

type SeededEmployee = {
  id: number;
  userId: number;
  username: string;
  person: PersonSeed;
  department: DepartmentCode;
  team: string | null;
  isHead: boolean;
  isLead: boolean;
  /** Employee code of the direct manager; null for department heads. */
  managerCode: string | null;
  roles: RoleName[];
  terminatedOn: Date | null;
};

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new Error(
      "The database already has data. Run `npx prisma migrate reset` to wipe it and seed from scratch."
    );
  }

  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123456";
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS ?? 10));

  const roleIds = await seedAccessControl();
  await seedCatalogs();
  const skillIds = new Map(
    (await prisma.skill.findMany({ select: { id: true, code: true } })).map((skill) => [skill.code, skill.id])
  );
  const leaveTypeByCode = new Map(
    (await prisma.leaveType.findMany()).map((leaveType) => [leaveType.code, leaveType])
  );

  const admin = await prisma.user.create({
    data: {
      username: process.env.DEFAULT_ADMIN_USERNAME ?? "admin",
      email: process.env.DEFAULT_ADMIN_EMAIL ?? "admin@corehr.local",
      passwordHash,
      userRoles: { create: [{ roleId: roleIds.ADMIN }] }
    }
  });

  const { departmentIds, positionByCode } = await seedDepartmentsAndPositions(skillIds);
  const employees = await seedEmployees(passwordHash, roleIds, admin.id, departmentIds, positionByCode);
  const teamIds = await seedTeamsAndManagers(employees, departmentIds);
  await seedEmployeeSkills(employees, positionByCode, skillIds);
  const taskCount = await seedProjectsAndTasks(employees, departmentIds, teamIds, skillIds);
  const approvedLeaveDays = await seedLeaveRequests(employees, leaveTypeByCode, admin.id);
  const attendanceCount = await seedAttendance(employees, approvedLeaveDays);

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED_DATABASE",
      entityType: "System",
      entityId: "seed",
      newValue: {
        departments: departments.length,
        employees: employees.size,
        projects: projects.length,
        tasks: taskCount,
        leaveRequests: leaveRequests.length,
        attendanceRecords: attendanceCount
      }
    }
  });

  printSummary(admin.username, employees, {
    tasks: taskCount,
    attendanceCount
  });
}

async function seedAccessControl() {
  await prisma.role.createMany({
    data: roles.map((name) => ({ name, description: `${name} role`, isSystem: true }))
  });
  await prisma.permission.createMany({
    data: permissions.map((code) => ({ code, description: code.replace(/_/g, " ").toLowerCase() }))
  });

  const roleRows = await prisma.role.findMany();
  const permissionRows = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleIds = Object.fromEntries(roleRows.map((row) => [row.name, row.id])) as Record<RoleName, number>;

  await prisma.rolePermission.createMany({
    data: roles.flatMap((role) =>
      rolePermissions[role].map((code) => {
        const permissionId = permissionIdByCode.get(code);
        assert(permissionId, `role ${role} references unknown permission ${code}`);
        return { roleId: roleIds[role], permissionId };
      })
    )
  });

  return roleIds;
}

async function seedCatalogs() {
  await prisma.leaveType.createMany({
    data: leaveTypes.map(([code, name, annualAllowance, isPaid]) => ({
      code,
      name,
      annualAllowance,
      isPaid
    }))
  });

  await prisma.skill.createMany({
    data: skills.map(([code, name, category]) => ({ code, name, category }))
  });

  await prisma.systemSetting.create({
    data: {
      key: "default",
      value: {
        workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        leaveCalculation: "WEEKDAYS_ONLY",
        phase: "PHASE_1",
        companyName: "Công ty Cổ phần OmniHR",
        companyAddress: "Tầng 12, 72 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
        // Left unset on purpose so check-in works from any location while testing.
        companyLatitude: null,
        companyLongitude: null,
        attendanceRadiusMeters: 150,
        requireAttendanceLocation: true,
        timezoneOffsetMinutes: TZ_OFFSET_MINUTES,
        attendanceEarlyCheckInMinutes: EARLY_CHECK_IN_MINUTES,
        attendanceGraceMinutes: 5,
        overtimeRatePercent: 150,
        insuranceRatePercent: 10.5,
        seniorityLeaveEveryYears: 5,
        annualLeaveCarryOverMaxDays: 5,
        morningShiftStart: "08:00",
        morningShiftEnd: "12:00",
        afternoonShiftStart: "13:00",
        afternoonShiftEnd: "17:00"
      }
    }
  });
}

async function seedDepartmentsAndPositions(skillIds: Map<string, number>) {
  const departmentIds = {} as Record<DepartmentCode, number>;
  for (const [code, name] of departments) {
    const department = await prisma.department.create({ data: { code, name } });
    departmentIds[code] = department.id;
  }

  const positionByCode = new Map<
    string,
    { id: number; name: string; department: DepartmentCode; skills: readonly string[]; isManager: boolean }
  >();
  for (const [code, name, department, positionSkills] of positions) {
    const position = await prisma.position.create({
      data: {
        code,
        name,
        departmentId: departmentIds[department],
        positionSkills: {
          create: positionSkills.map((skillCode) => {
            const skillId = skillIds.get(skillCode);
            assert(skillId, `position ${code} references unknown skill ${skillCode}`);
            return { skillId };
          })
        }
      }
    });
    positionByCode.set(code, {
      id: position.id,
      name,
      department,
      skills: positionSkills,
      isManager: isManagerPosition(code, name)
    });
  }

  return { departmentIds, positionByCode };
}

async function seedEmployees(
  passwordHash: string,
  roleIds: Record<RoleName, number>,
  adminUserId: number,
  departmentIds: Record<DepartmentCode, number>,
  positionByCode: Map<string, { id: number; department: DepartmentCode; isManager: boolean }>
) {
  const employees = new Map<string, SeededEmployee>();
  const usedUsernames = new Set<string>();
  let sequence = 0;

  const create = async (
    seed: PersonSeed,
    department: DepartmentCode,
    team: string | null,
    kind: "head" | "lead" | "member",
    managerCode: string | null
  ) => {
    assert(!employees.has(seed.code), `duplicate employee code ${seed.code}`);
    const position = positionByCode.get(seed.position);
    assert(position, `${seed.code} has unknown position ${seed.position}`);
    assert(position.department === department, `${seed.code}'s position belongs to another department`);
    assert(
      position.isManager === (kind !== "member"),
      `${seed.code} is a ${kind} but position ${seed.position} ${position.isManager ? "is" : "is not"} a manager position`
    );

    let username = usernameFor(seed.fullName);
    for (let suffix = 2; usedUsernames.has(username); suffix += 1) {
      username = `${usernameFor(seed.fullName)}${suffix}`;
    }
    usedUsernames.add(username);

    const roleNames: RoleName[] = ["EMPLOYEE"];
    if (position.isManager) {
      roleNames.push("MANAGER");
    }

    sequence += 1;
    const terminatedOn = seed.terminatedOn ? dateOnly(seed.terminatedOn) : null;
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@omnihr.vn`,
        passwordHash,
        isActive: !terminatedOn,
        lastLoginAt: terminatedOn ? at(terminatedOn, hm("17:05")) : at(workday(-1), hm("08:02") + sequence),
        userRoles: {
          create: roleNames.map((role) => ({ roleId: roleIds[role], assignedBy: adminUserId }))
        }
      }
    });
    const employee = await prisma.employee.create({
      data: {
        employeeCode: seed.code,
        fullName: seed.fullName,
        companyEmail: `${username}@omnihr.vn`,
        personalEmail: `${username}.${seed.birthDate.slice(0, 4)}@gmail.com`,
        phone: `09${String(12_345_678 + sequence * 7_919).slice(-8)}`,
        birthDate: dateOnly(seed.birthDate),
        hireDate: dateOnly(seed.hireDate),
        status: terminatedOn ? EmployeeStatus.TERMINATED : EmployeeStatus.ACTIVE,
        departmentId: departmentIds[department],
        positionId: position.id,
        careerLevel: seed.level,
        userId: user.id
      }
    });

    employees.set(seed.code, {
      id: employee.id,
      userId: user.id,
      username,
      person: seed,
      department,
      team,
      isHead: kind === "head",
      isLead: kind === "lead",
      managerCode,
      roles: roleNames,
      terminatedOn
    });
  };

  for (const department of organization) {
    await create(department.head, department.code, null, "head", null);
    for (const team of department.teams) {
      await create(team.lead, department.code, team.code, "lead", department.head.code);
      for (const member of team.members) {
        await create(member, department.code, team.code, "member", team.lead.code);
      }
    }
  }

  return employees;
}

async function seedTeamsAndManagers(
  employees: Map<string, SeededEmployee>,
  departmentIds: Record<DepartmentCode, number>
) {
  const teamIds = new Map<string, number>();

  for (const department of organization) {
    const head = employees.get(department.head.code)!;
    await prisma.department.update({
      where: { id: departmentIds[department.code] },
      data: { managerId: head.id }
    });

    for (const team of department.teams) {
      const lead = employees.get(team.lead.code)!;
      const created = await prisma.team.create({
        data: {
          code: team.code,
          name: team.name,
          description: team.description,
          departmentId: departmentIds[department.code],
          leadId: lead.id,
          members: {
            create: [team.lead, ...team.members].map((seed) => {
              const employee = employees.get(seed.code)!;
              return {
                employeeId: employee.id,
                role: seed === team.lead ? TeamMemberRole.LEAD : TeamMemberRole.MEMBER,
                joinedAt: laterOf(dateOnly(seed.hireDate), TEAMS_FORMED_ON),
                leftAt: employee.terminatedOn,
                isActive: !employee.terminatedOn
              };
            })
          }
        }
      });
      teamIds.set(team.code, created.id);
    }
  }

  for (const employee of employees.values()) {
    if (!employee.managerCode) {
      continue;
    }
    const manager = employees.get(employee.managerCode)!;
    await prisma.employeeManager.create({
      data: {
        employeeId: employee.id,
        managerId: manager.id,
        managerType: ManagerType.DIRECT,
        startDate: laterOf(dateOnly(employee.person.hireDate), TEAMS_FORMED_ON),
        endDate: employee.terminatedOn,
        isActive: !employee.terminatedOn
      }
    });
  }

  return teamIds;
}

async function seedEmployeeSkills(
  employees: Map<string, SeededEmployee>,
  positionByCode: Map<string, { skills: readonly string[] }>,
  skillIds: Map<string, number>
) {
  const rows: Prisma.EmployeeSkillCreateManyInput[] = [];
  for (const employee of employees.values()) {
    const { person: seed } = employee;
    const positionSkills = positionByCode.get(seed.position)!.skills;
    const chosen = seed.skills ?? positionSkills.slice(0, skillCountByLevel[seed.level]);
    chosen.forEach((skillCode, index) => {
      assert(
        positionSkills.includes(skillCode),
        `${seed.code} has skill ${skillCode} that is not applicable to position ${seed.position}`
      );
      rows.push({
        employeeId: employee.id,
        skillId: skillIds.get(skillCode)!,
        proficiency: proficiencyFor(seed.level, index),
        yearsExperience: Math.max(0.5, yearsByLevel[seed.level] - index * 0.5),
        lastUsedAt: employee.terminatedOn ?? workday(-randomInt(1, 20))
      });
    });
  }
  await prisma.employeeSkill.createMany({ data: rows });
}
async function seedProjectsAndTasks(
  employees: Map<string, SeededEmployee>,
  departmentIds: Record<DepartmentCode, number>,
  teamIds: Map<string, number>,
  skillIds: Map<string, number>
) {
  let taskCount = 0;

  for (const seed of projects) {
    const department = organization.find((item) => item.code === seed.department)!;
    const head = employees.get(department.head.code)!;
    const projectStart = workday(seed.start);
    const project = await prisma.project.create({
      data: {
        code: seed.code,
        name: seed.name,
        description: seed.description,
        status: seed.status,
        departmentId: departmentIds[seed.department],
        // Only a department head may create a project, and they manage it.
        managerId: head.id,
        createdByUserId: head.userId,
        startDate: projectStart,
        endDate: workday(seed.end),
        createdAt: notAfterNow(at(addDays(projectStart, -7), hm("10:00")))
      }
    });

    for (const teamTask of seed.tasks) {
      const team = department.teams.find((item) => item.code === teamTask.team);
      assert(team, `task "${teamTask.title}" uses team ${teamTask.team} outside department ${seed.department}`);
      const lead = employees.get(team.lead.code)!;
      const memberCodes = [team.lead, ...team.members].map((member) => member.code);

      const subtasks = teamTask.subtasks.map((subtask) => {
        assert(subtask.start <= subtask.due, `subtask "${subtask.title}" starts after its due date`);
        assert(
          subtask.assignee === null || memberCodes.includes(subtask.assignee),
          `subtask "${subtask.title}" is assigned to ${subtask.assignee}, who is not in team ${team.code}`
        );
        assert(
          seed.status !== ProjectStatus.COMPLETED || subtask.status === DONE,
          `subtask "${subtask.title}" is open in completed project ${seed.code}`
        );
        const startDate = workday(subtask.start);
        const dueDate = workday(subtask.due);
        const actualHours =
          subtask.actualHours ??
          (subtask.status === DONE ? subtask.estimatedHours : 0);
        const completedAt =
          subtask.status === DONE ? notAfterNow(at(dueDate > TODAY ? workday(-1) : dueDate, hm("16:30"))) : null;
        return { ...subtask, startDate, dueDate, actualHours, completedAt };
      });

      // A team-level task spans its subtasks; its status and hours are derived
      // from them exactly like TasksService.syncParentStatus.
      const parentStart = new Date(Math.min(...subtasks.map((item) => item.startDate.getTime())));
      const parentDue = new Date(Math.max(...subtasks.map((item) => item.dueDate.getTime())));
      const parentStatus = deriveParentStatus(subtasks.map((item) => item.status));
      const parentCreatedAt = notAfterNow(at(addDays(parentStart, -2), hm("09:00")));
      const parent = await prisma.task.create({
        data: {
          title: teamTask.title,
          description: teamTask.description,
          technologies: teamTask.technologies,
          projectId: project.id,
          departmentId: departmentIds[seed.department],
          teamId: teamIds.get(team.code)!,
          priority: subtasks.some((item) => item.priority === URGENT) ? URGENT : HIGH,
          status: parentStatus,
          createdByUserId: head.userId,
          assignedByUserId: head.userId,
          startDate: parentStart,
          dueDate: parentDue,
          estimatedHours: subtasks.reduce((sum, item) => sum + item.estimatedHours, 0),
          actualHours: subtasks.reduce((sum, item) => sum + item.actualHours, 0),
          completedAt:
            parentStatus === DONE
              ? new Date(Math.max(...subtasks.map((item) => item.completedAt!.getTime())))
              : null,
          createdAt: parentCreatedAt
        }
      });
      taskCount += 1;

      for (const subtask of subtasks) {
        const assignee = subtask.assignee ? employees.get(subtask.assignee)! : null;
        const createdAt = laterOf(parentCreatedAt, notAfterNow(at(addDays(subtask.startDate, -1), hm("10:00"))));
        const created = await prisma.task.create({
          data: {
            parentTaskId: parent.id,
            title: subtask.title,
            projectId: project.id,
            departmentId: departmentIds[seed.department],
            teamId: teamIds.get(team.code)!,
            priority: subtask.priority,
            status: subtask.status,
            assigneeId: assignee?.id ?? null,
            createdByUserId: lead.userId,
            assignedByUserId: assignee ? lead.userId : null,
            startDate: subtask.startDate,
            dueDate: subtask.dueDate,
            estimatedHours: subtask.estimatedHours,
            actualHours: subtask.actualHours,
            completedAt: subtask.completedAt,
            createdAt,
            requiredSkills: {
              create: subtask.skills.map(([skillCode, requiredProficiency, importance]) => {
                const skillId = skillIds.get(skillCode);
                assert(skillId, `subtask "${subtask.title}" requires unknown skill ${skillCode}`);
                return { skillId, requiredProficiency, importance };
              })
            }
          }
        });
        taskCount += 1;

        if (assignee) {
          const assignedAt = laterOf(createdAt, notAfterNow(at(addDays(subtask.startDate, -1), hm("10:15"))));
          await prisma.taskAssignment.create({
            data: {
              taskId: created.id,
              assigneeId: assignee.id,
              assignedByUserId: lead.userId,
              assignmentType: TaskAssignmentType.MANUAL,
              note: "Phân công theo kế hoạch của nhóm",
              assignedAt
            }
          });
          if (!assignee.terminatedOn) {
            await prisma.notification.create({
              data: {
                userId: assignee.userId,
                type: NotificationType.TASK_ASSIGNED,
                title: "New task assigned",
                message: `You were assigned to "${subtask.title}".`,
                entityType: "Task",
                entityId: created.id,
                isRead: subtask.status !== TODO || assignedAt < addDays(NOW, -3),
                createdAt: assignedAt
              }
            });
          }
        }
      }
    }
  }

  return taskCount;
}

function deriveParentStatus(statuses: TaskStatus[]): TaskStatus {
  const nonCancelled = statuses.filter((status) => status !== CANCELLED);
  if (!nonCancelled.length) {
    return TODO;
  }
  if (nonCancelled.every((status) => status === DONE)) {
    return DONE;
  }
  if (nonCancelled.some((status) => status === IN_PROGRESS || status === IN_REVIEW || status === DONE)) {
    return IN_PROGRESS;
  }
  return TODO;
}

/** Returns, per employee id, the work dates covered by approved leave. */
async function seedLeaveRequests(
  employees: Map<string, SeededEmployee>,
  leaveTypeByCode: Map<string, { id: number; annualAllowance: number | null }>,
  adminUserId: number
) {
  const approvedDays = new Map<number, Set<number>>();
  const takenRanges = new Map<string, Array<[Date, Date]>>();

  for (const seed of leaveRequests) {
    const employee = employees.get(seed.employee);
    assert(employee && !employee.terminatedOn, `leave request for unknown or former employee ${seed.employee}`);
    const startDate = workday(seed.start);
    const endDate = workday(seed.end);
    assert(startDate <= endDate, `leave request of ${seed.employee} ends before it starts`);

    // Rejected and cancelled requests may overlap others; active ones may not.
    if (seed.status === APPROVED || seed.status === PENDING) {
      const ranges = takenRanges.get(seed.employee) ?? [];
      assert(
        ranges.every(([from, to]) => endDate < from || startDate > to),
        `leave requests of ${seed.employee} overlap`
      );
      ranges.push([startDate, endDate]);
      takenRanges.set(seed.employee, ranges);
    }

    const approver = employee.managerCode ? employees.get(employee.managerCode)!.userId : adminUserId;
    const createdAt = notAfterNow(at(addDays(startDate, -6), hm("09:30")));
    const decidedAt = laterOf(createdAt, notAfterNow(at(addDays(startDate, -4), hm("14:00"))));
    const leaveType = leaveTypeByCode.get(seed.type)!;

    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        totalDays: workdaysInclusive(startDate, endDate),
        reason: seed.reason,
        status: seed.status,
        approverUserId: seed.status === APPROVED || seed.status === REJECTED ? approver : null,
        approvedAt: seed.status === APPROVED ? decidedAt : null,
        rejectionReason: seed.rejectionReason ?? null,
        canceledAt: seed.status === LEAVE_CANCELLED ? decidedAt : null,
        createdAt
      }
    });

    if (seed.status === APPROVED) {
      const days = approvedDays.get(employee.id) ?? new Set<number>();
      for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
        days.add(day.getTime());
      }
      approvedDays.set(employee.id, days);
    }

    if (seed.status === APPROVED || seed.status === REJECTED) {
      await prisma.notification.create({
        data: {
          userId: employee.userId,
          type: seed.status === APPROVED ? NotificationType.LEAVE_APPROVED : NotificationType.LEAVE_REJECTED,
          title: seed.status === APPROVED ? "Leave request approved" : "Leave request rejected",
          message:
            seed.status === APPROVED
              ? `Your leave request from ${startDate.toDateString()} to ${endDate.toDateString()} was approved.`
              : seed.rejectionReason!,
          entityType: "LeaveRequest",
          entityId: request.id,
          isRead: decidedAt < addDays(NOW, -2),
          createdAt: decidedAt
        }
      });
    }
  }

  return approvedDays;
}

/**
 * Check-in/out for every workday of the anchor month up to the day before the
 * anchor (never the anchor day itself, so the mobile check-in can be tried
 * right away on a freshly seeded database).
 * Shift and status follow AttendanceService: the shift comes from the
 * check-in time, LATE after the shift start, EARLY_OUT when checking out
 * before the check-in shift ends.
 */
async function seedAttendance(
  employees: Map<string, SeededEmployee>,
  approvedLeaveDays: Map<number, Set<number>>
) {
  const rows: Prisma.AttendanceRecordCreateManyInput[] = [];
  const days = workdaysBetween(firstOfAnchorMonth(TODAY), workday(-1));

  for (const employee of employees.values()) {
    const hireDate = dateOnly(employee.person.hireDate);
    const latenessRate = 0.03 + random() * 0.1;
    const staysLate = employee.isHead || employee.isLead;

    for (const day of days) {
      if (day < hireDate || (employee.terminatedOn && day > employee.terminatedOn)) {
        continue;
      }
      if (approvedLeaveDays.get(employee.id)?.has(day.getTime())) {
        continue;
      }

      const roll = random();
      if (roll < 0.015) {
        continue; // absent without a request
      }

      let checkIn: number;
      let checkOut: number | null;
      if (roll < 0.045) {
        // Worked the afternoon shift only.
        checkIn = randomInt(hm("12:50"), hm("13:12"));
        checkOut = random() < 0.3 ? randomInt(hm("16:35"), hm("16:58")) : randomInt(hm("17:00"), hm("17:30"));
      } else {
        checkIn = random() < latenessRate ? randomInt(hm("08:01"), hm("08:35")) : randomInt(hm("07:35"), hm("08:00"));
        checkOut =
          staysLate && random() < 0.2 ? randomInt(hm("18:10"), hm("19:40")) : randomInt(hm("17:00"), hm("17:50"));
      }
      if (random() < 0.025) {
        checkOut = null; // forgot to check out
      }

      const shift = SHIFTS.find(
        (item) => checkIn >= item.start - EARLY_CHECK_IN_MINUTES && checkIn <= item.end
      )!;
      const location = {
        latitude: Number((OFFICE.latitude + (random() - 0.5) * 0.0006).toFixed(6)),
        longitude: Number((OFFICE.longitude + (random() - 0.5) * 0.0006).toFixed(6)),
        source: "MOBILE",
        createdByUserId: employee.userId
      };

      rows.push({
        employeeId: employee.id,
        workDate: day,
        recordType: AttendanceRecordType.CHECK_IN,
        recordedAt: at(day, checkIn),
        shift: shift.shift,
        attendanceStatus: checkIn > shift.start ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
        ...location
      });
      if (checkOut !== null) {
        rows.push({
          employeeId: employee.id,
          workDate: day,
          recordType: AttendanceRecordType.CHECK_OUT,
          recordedAt: at(day, checkOut),
          shift: shift.shift,
          attendanceStatus: checkOut < shift.end ? AttendanceStatus.EARLY_OUT : AttendanceStatus.ON_TIME,
          ...location
        });
      }
    }
  }

  await prisma.attendanceRecord.createMany({ data: rows });
  return rows.length;
}
function printSummary(
  adminUsername: string,
  employees: Map<string, SeededEmployee>,
  counts: { tasks: number; attendanceCount: number }
) {
  const describe = (code: string, label: string) => {
    const employee = employees.get(code)!;
    return { account: employee.username, who: `${employee.person.fullName} — ${label}`, roles: employee.roles.join(", ") };
  };

  console.info("\nSeed completed.");
  console.info(
    `Departments: ${departments.length}, employees: ${employees.size}, projects: ${projects.length}, ` +
      `tasks: ${counts.tasks}, attendance records: ${counts.attendanceCount}`
  );
  console.table([
    { account: adminUsername, who: "Quản trị hệ thống", roles: "ADMIN" },
    describe("IT001", "Trưởng phòng CNTT"),
    describe("IT002", "Trưởng nhóm Backend"),
    describe("IT003", "Lập trình viên Backend"),
    describe("HR001", "Trưởng phòng Nhân sự"),
    describe("HR006", "Trưởng nhóm C&B"),
    describe("FIN001", "Kế toán trưởng"),
    describe("SAL001", "Trưởng phòng Kinh doanh"),
    describe("OPS001", "Trưởng phòng Hành chính - Vận hành")
  ]);
  console.info("Every account uses the DEFAULT_ADMIN_PASSWORD password.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
