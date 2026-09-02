import {
  AiTaskSuggestionStatus,
  AttendanceRecordType,
  CareerLevel,
  EmployeeStatus,
  LeaveRequestStatus,
  ManagerType,
  PrismaClient,
  SkillProficiency,
  TaskAssignmentType,
  TaskSkillImportance,
  TaskPriority,
  TaskStatus
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const roles = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;

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

const adminPermissions = permissions;

const leaveTypes = [
  ["ANNUAL_LEAVE", "Nghỉ phép năm", 12],
  ["SICK_LEAVE", "Nghỉ ốm", 30],
  ["UNPAID_LEAVE", "Nghỉ không lương", null],
  ["MATERNITY_LEAVE", "Nghỉ thai sản", 180],
  ["MARRIAGE_LEAVE", "Nghỉ kết hôn", 3],
  ["BEREAVEMENT_LEAVE", "Nghỉ tang chế", 3]
] as const;

const skills = [
  ["ACTIVE_DIRECTORY", "Active Directory", "Infrastructure"],
  ["AGILE_SCRUM", "Agile/Scrum", "Management"],
  ["AIRFLOW", "Apache Airflow", "Data"],
  ["ANDROID", "Android", "Mobile"],
  ["API_TESTING", "API Testing", "Quality"],
  ["AWS", "Amazon Web Services", "Cloud"],
  ["AZURE", "Microsoft Azure", "Cloud"],
  ["BACKUP_RESTORE", "Backup & Restore", "Infrastructure"],
  ["BIGQUERY", "BigQuery", "Data"],
  ["BPMN", "BPMN", "Business Analysis"],
  ["CI_CD", "CI/CD", "DevOps"],
  ["CLEAN_CODE", "Clean Code", "Engineering"],
  ["CODE_REVIEW", "Code Review", "Engineering"],
  ["CSS", "CSS", "Frontend"],
  ["DART", "Dart", "Mobile"],
  ["DATA_MODELING", "Data Modeling", "Data"],
  ["DESIGN_PATTERNS", "Design Patterns", "Engineering"],
  ["DJANGO", "Django", "Backend"],
  ["DOCUMENTATION", "Documentation", "Business Analysis"],
  ["DOCKER", "Docker", "DevOps"],
  ["DOTNET", ".NET", "Backend"],
  ["ELASTICSEARCH", "Elasticsearch", "Backend"],
  ["ETL", "ETL", "Data"],
  ["EXPRESS", "Express.js", "Backend"],
  ["FIGMA", "Figma", "Design"],
  ["FIREBASE", "Firebase", "Mobile"],
  ["FLUTTER", "Flutter", "Mobile"],
  ["GCP", "Google Cloud Platform", "Cloud"],
  ["GIT", "Git", "Engineering"],
  ["GITHUB_ACTIONS", "GitHub Actions", "DevOps"],
  ["GITLAB_CI", "GitLab CI", "DevOps"],
  ["GO", "Go", "Backend"],
  ["GRAFANA", "Grafana", "DevOps"],
  ["GRAPHQL", "GraphQL", "Backend"],
  ["HARDWARE", "Hardware Support", "IT Support"],
  ["HELPDESK", "Helpdesk", "IT Support"],
  ["HTML", "HTML", "Frontend"],
  ["IAM", "Identity & Access Management", "Security"],
  ["IOS", "iOS", "Mobile"],
  ["JAVA", "Java", "Backend"],
  ["JAVASCRIPT", "JavaScript", "Frontend"],
  ["KAFKA", "Kafka", "Backend"],
  ["KOTLIN", "Kotlin", "Mobile"],
  ["KUBERNETES", "Kubernetes", "DevOps"],
  ["LINUX", "Linux", "Infrastructure"],
  ["MANUAL_TESTING", "Manual Testing", "Quality"],
  ["MICROSERVICES", "Microservices", "Architecture"],
  ["MOBILE_CI_CD", "Mobile CI/CD", "Mobile"],
  ["M365", "Microsoft 365", "IT Support"],
  ["MONITORING", "Monitoring", "DevOps"],
  ["MYSQL", "MySQL", "Database"],
  ["NESTJS", "NestJS", "Backend"],
  ["NETWORKING", "Networking", "Infrastructure"],
  ["NEXTJS", "Next.js", "Frontend"],
  ["NGINX", "Nginx", "Infrastructure"],
  ["NODEJS", "Node.js", "Backend"],
  ["OOP", "OOP", "Engineering"],
  ["OWASP", "OWASP", "Security"],
  ["PENETRATION_TESTING", "Penetration Testing", "Security"],
  ["PEOPLE_MANAGEMENT", "People Management", "Management"],
  ["PERFORMANCE_TESTING", "Performance Testing", "Quality"],
  ["PLAYWRIGHT", "Playwright", "Quality"],
  ["POSTGRESQL", "PostgreSQL", "Database"],
  ["POWER_BI", "Power BI", "Data"],
  ["PRISMA", "Prisma", "Backend"],
  ["PRODUCT_DISCOVERY", "Product Discovery", "Product"],
  ["PROJECT_PLANNING", "Project Planning", "Management"],
  ["PROMETHEUS", "Prometheus", "DevOps"],
  ["PYTHON", "Python", "Backend"],
  ["RABBITMQ", "RabbitMQ", "Backend"],
  ["REACT", "React", "Frontend"],
  ["REACT_NATIVE", "React Native", "Mobile"],
  ["REDIS", "Redis", "Backend"],
  ["REQUIREMENT_ANALYSIS", "Requirement Analysis", "Business Analysis"],
  ["REST_API", "REST API", "Backend"],
  ["RISK_MANAGEMENT", "Risk Management", "Management"],
  ["ROADMAP", "Roadmap Planning", "Product"],
  ["SELENIUM", "Selenium", "Quality"],
  ["SIEM", "SIEM", "Security"],
  ["SOLID", "SOLID", "Engineering"],
  ["SPRING_BOOT", "Spring Boot", "Backend"],
  ["SQL", "SQL", "Database"],
  ["STAKEHOLDER_MANAGEMENT", "Stakeholder Management", "Management"],
  ["SWIFT", "Swift", "Mobile"],
  ["SYSTEM_DESIGN", "System Design", "Architecture"],
  ["TAILWIND", "Tailwind CSS", "Frontend"],
  ["TEAM_LEADERSHIP", "Team Leadership", "Management"],
  ["TERRAFORM", "Terraform", "DevOps"],
  ["TESTING", "Testing", "Quality"],
  ["TYPESCRIPT", "TypeScript", "Engineering"],
  ["UI_UX", "UI/UX", "Design"],
  ["USER_STORY", "User Story", "Business Analysis"],
  ["VPN", "VPN", "Infrastructure"],
  ["VULNERABILITY_ASSESSMENT", "Vulnerability Assessment", "Security"],
  ["VUE", "Vue.js", "Frontend"],
  ["WINDOWS_SERVER", "Windows Server", "Infrastructure"]
] as const;

const positionSkillMap: Record<string, string[]> = {
  BE_DEV: [
    "GIT",
    "OOP",
    "SOLID",
    "REST_API",
    "NODEJS",
    "NESTJS",
    "EXPRESS",
    "POSTGRESQL",
    "MYSQL",
    "REDIS",
    "PRISMA",
    "RABBITMQ",
    "DOCKER",
    "TESTING",
    "TYPESCRIPT"
  ],
  BUSINESS_ANALYST: [
    "REQUIREMENT_ANALYSIS",
    "BPMN",
    "USER_STORY",
    "AGILE_SCRUM",
    "STAKEHOLDER_MANAGEMENT",
    "DOCUMENTATION"
  ],
  DATA_ENGINEER: [
    "SQL",
    "PYTHON",
    "DATA_MODELING",
    "ETL",
    "AIRFLOW",
    "POSTGRESQL",
    "BIGQUERY",
    "DOCKER"
  ],
  DATABASE_ADMIN: [
    "SQL",
    "POSTGRESQL",
    "MYSQL",
    "DATA_MODELING",
    "BACKUP_RESTORE",
    "LINUX",
    "MONITORING"
  ],
  DEVOPS_ENGINEER: [
    "LINUX",
    "DOCKER",
    "KUBERNETES",
    "CI_CD",
    "GITHUB_ACTIONS",
    "GITLAB_CI",
    "NGINX",
    "AWS",
    "AZURE",
    "TERRAFORM",
    "PROMETHEUS",
    "GRAFANA"
  ],
  ENG_MANAGER: [
    "AGILE_SCRUM",
    "SYSTEM_DESIGN",
    "CODE_REVIEW",
    "PROJECT_PLANNING",
    "RISK_MANAGEMENT",
    "TEAM_LEADERSHIP",
    "PEOPLE_MANAGEMENT",
    "STAKEHOLDER_MANAGEMENT"
  ],
  FE_DEV: [
    "GIT",
    "HTML",
    "CSS",
    "JAVASCRIPT",
    "TYPESCRIPT",
    "REACT",
    "NEXTJS",
    "VUE",
    "TAILWIND",
    "UI_UX",
    "PLAYWRIGHT",
    "TESTING"
  ],
  FULLSTACK_DEV: [
    "GIT",
    "TYPESCRIPT",
    "REACT",
    "NEXTJS",
    "NODEJS",
    "NESTJS",
    "REST_API",
    "GRAPHQL",
    "POSTGRESQL",
    "PRISMA",
    "REDIS",
    "DOCKER",
    "TESTING"
  ],
  HR_SPECIALIST: ["TESTING"],
  IT_MANAGER: [
    "AGILE_SCRUM",
    "PROJECT_PLANNING",
    "RISK_MANAGEMENT",
    "TEAM_LEADERSHIP",
    "PEOPLE_MANAGEMENT",
    "STAKEHOLDER_MANAGEMENT",
    "ROADMAP"
  ],
  IT_SUPPORT: [
    "HELPDESK",
    "HARDWARE",
    "WINDOWS_SERVER",
    "M365",
    "ACTIVE_DIRECTORY",
    "NETWORKING",
    "VPN",
    "BACKUP_RESTORE"
  ],
  MOBILE_DEV: [
    "GIT",
    "DART",
    "FLUTTER",
    "ANDROID",
    "KOTLIN",
    "IOS",
    "SWIFT",
    "REACT_NATIVE",
    "FIREBASE",
    "REST_API",
    "MOBILE_CI_CD",
    "TESTING"
  ],
  NETWORK_ENGINEER: ["NETWORKING", "LINUX", "NGINX", "VPN", "SIEM", "BACKUP_RESTORE"],
  PRODUCT_OWNER: [
    "PRODUCT_DISCOVERY",
    "ROADMAP",
    "REQUIREMENT_ANALYSIS",
    "USER_STORY",
    "STAKEHOLDER_MANAGEMENT",
    "AGILE_SCRUM"
  ],
  QA_ENGINEER: [
    "MANUAL_TESTING",
    "AUTOMATION_TESTING",
    "API_TESTING",
    "PLAYWRIGHT",
    "SELENIUM",
    "PERFORMANCE_TESTING",
    "TESTING"
  ],
  SCRUM_MASTER: [
    "AGILE_SCRUM",
    "PROJECT_PLANNING",
    "RISK_MANAGEMENT",
    "TEAM_LEADERSHIP",
    "STAKEHOLDER_MANAGEMENT"
  ],
  SECURITY_ENGINEER: [
    "OWASP",
    "IAM",
    "SIEM",
    "VULNERABILITY_ASSESSMENT",
    "PENETRATION_TESTING",
    "LINUX",
    "NETWORKING"
  ],
  SOFTWARE_ARCHITECT: [
    "SYSTEM_DESIGN",
    "DESIGN_PATTERNS",
    "MICROSERVICES",
    "REST_API",
    "GRAPHQL",
    "KAFKA",
    "DOCKER",
    "KUBERNETES",
    "CODE_REVIEW",
    "TYPESCRIPT"
  ],
  SYSTEM_ADMIN: [
    "LINUX",
    "WINDOWS_SERVER",
    "ACTIVE_DIRECTORY",
    "M365",
    "NGINX",
    "BACKUP_RESTORE",
    "MONITORING",
    "VPN"
  ],
  TECH_LEAD: [
    "SYSTEM_DESIGN",
    "DESIGN_PATTERNS",
    "CODE_REVIEW",
    "SOLID",
    "MICROSERVICES",
    "TYPESCRIPT",
    "DOCKER",
    "KUBERNETES",
    "TEAM_LEADERSHIP"
  ],
  UI_UX_DESIGNER: [
    "FIGMA",
    "UI_UX",
    "HTML",
    "CSS",
    "PRODUCT_DISCOVERY",
    "REQUIREMENT_ANALYSIS"
  ]
};

const mockDepartments = [
  ["ENG", "Engineering"],
  ["IT", "Công nghệ thông tin"],
  ["OPS", "Operations"],
  ["HR", "Human Resources"]
] as const;

const mockPositions = [
  ["IT_MANAGER", "Trưởng phòng Công nghệ thông tin", "IT"],
  ["ENG_MANAGER", "Quản lý kỹ thuật", "IT"],
  ["TECH_LEAD", "Trưởng nhóm kỹ thuật", "IT"],
  ["SOFTWARE_ARCHITECT", "Kiến trúc sư phần mềm", "IT"],
  ["PRODUCT_OWNER", "Product Owner", "IT"],
  ["SCRUM_MASTER", "Scrum Master", "IT"],
  ["BUSINESS_ANALYST", "Business Analyst", "IT"],
  ["UI_UX_DESIGNER", "UI/UX Designer", "IT"],
  ["FE_DEV", "Lập trình viên Frontend", "IT"],
  ["BE_DEV", "Lập trình viên Backend", "IT"],
  ["FULLSTACK_DEV", "Lập trình viên Fullstack", "IT"],
  ["MOBILE_DEV", "Lập trình viên Mobile", "IT"],
  ["QA_ENGINEER", "QA Engineer", "IT"],
  ["DEVOPS_ENGINEER", "DevOps Engineer", "IT"],
  ["DATA_ENGINEER", "Data Engineer", "IT"],
  ["DATABASE_ADMIN", "Quản trị cơ sở dữ liệu", "IT"],
  ["SECURITY_ENGINEER", "Security Engineer", "IT"],
  ["SYSTEM_ADMIN", "Quản trị hệ thống", "IT"],
  ["NETWORK_ENGINEER", "Network Engineer", "IT"],
  ["IT_SUPPORT", "IT Support", "IT"],
  ["HR_SPECIALIST", "HR Specialist", "HR"]
] as const;

const mockUsers = [
  {
    username: "manager01",
    email: "manager01@omnihr.local",
    employeeCode: "MGR001",
    fullName: "Nguyễn Minh Quân",
    role: "MANAGER",
    positionCode: "ENG_MANAGER",
    careerLevel: CareerLevel.LEAD,
    departmentCode: "IT",
    birthDate: "1988-03-12",
    hireDate: "2020-01-15"
  },
  {
    username: "employee01",
    email: "employee01@omnihr.local",
    employeeCode: "EMP001",
    fullName: "Trần Anh Khoa",
    role: "EMPLOYEE",
    positionCode: "FE_DEV",
    careerLevel: CareerLevel.SENIOR,
    departmentCode: "IT",
    birthDate: "1996-06-20",
    hireDate: "2022-04-01"
  },
  {
    username: "employee02",
    email: "employee02@omnihr.local",
    employeeCode: "EMP002",
    fullName: "Lê Bảo Ngọc",
    role: "EMPLOYEE",
    positionCode: "BE_DEV",
    careerLevel: CareerLevel.MIDDLE,
    departmentCode: "IT",
    birthDate: "1994-09-08",
    hireDate: "2021-08-16"
  },
  {
    username: "employee03",
    email: "employee03@omnihr.local",
    employeeCode: "EMP003",
    fullName: "Phạm Gia Hân",
    role: "EMPLOYEE",
    positionCode: "QA_ENGINEER",
    careerLevel: CareerLevel.FRESHER,
    departmentCode: "IT",
    birthDate: "1997-12-03",
    hireDate: "2023-02-06"
  },
  {
    username: "employee04",
    email: "employee04@omnihr.local",
    employeeCode: "EMP004",
    fullName: "Đỗ Thu Linh",
    role: "EMPLOYEE",
    positionCode: "HR_SPECIALIST",
    careerLevel: CareerLevel.JUNIOR,
    departmentCode: "HR",
    birthDate: "1995-11-25",
    hireDate: "2022-10-10"
  }
] as const;

const mockEmployeeSkills: Record<
  string,
  Array<{
    skillCode: string;
    proficiency: SkillProficiency;
    yearsExperience: number;
  }>
> = {
  MGR001: [
    { skillCode: "TYPESCRIPT", proficiency: SkillProficiency.EXPERT, yearsExperience: 7 },
    { skillCode: "NESTJS", proficiency: SkillProficiency.ADVANCED, yearsExperience: 4 },
    { skillCode: "DOCKER", proficiency: SkillProficiency.ADVANCED, yearsExperience: 4 }
  ],
  EMP001: [
    { skillCode: "REACT", proficiency: SkillProficiency.EXPERT, yearsExperience: 5 },
    { skillCode: "TYPESCRIPT", proficiency: SkillProficiency.ADVANCED, yearsExperience: 4 },
    { skillCode: "UI_UX", proficiency: SkillProficiency.INTERMEDIATE, yearsExperience: 2 }
  ],
  EMP002: [
    { skillCode: "NESTJS", proficiency: SkillProficiency.EXPERT, yearsExperience: 5 },
    { skillCode: "PRISMA", proficiency: SkillProficiency.ADVANCED, yearsExperience: 3 },
    { skillCode: "POSTGRESQL", proficiency: SkillProficiency.ADVANCED, yearsExperience: 4 }
  ],
  EMP003: [
    { skillCode: "TESTING", proficiency: SkillProficiency.EXPERT, yearsExperience: 4 },
    { skillCode: "TYPESCRIPT", proficiency: SkillProficiency.INTERMEDIATE, yearsExperience: 2 },
    { skillCode: "REACT", proficiency: SkillProficiency.INTERMEDIATE, yearsExperience: 2 }
  ],
  EMP004: [
    { skillCode: "TESTING", proficiency: SkillProficiency.BEGINNER, yearsExperience: 1 }
  ]
};

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
  "SKILL_READ",
  "AI_TASK_SUGGEST",
  "AI_TASK_SELECT",
  "TASK_ASSIGNMENT_READ"
] as const;

const rolePermissions: Record<(typeof roles)[number], readonly string[]> = {
  ADMIN: adminPermissions,
  MANAGER: Array.from(
    new Set([...employeePermissions, ...managerExtraPermissions])
  ),
  EMPLOYEE: employeePermissions
};

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      create: {
        name,
        description: `${name} role`,
        isSystem: true
      },
      update: {
        description: `${name} role`,
        isSystem: true
      }
    });
  }

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      create: {
        code,
        description: code.replace(/_/g, " ").toLowerCase()
      },
      update: {}
    });
  }

  for (const roleName of roles) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const targetPermissions = await prisma.permission.findMany({
      where: { code: { in: [...rolePermissions[roleName]] } },
      select: { id: true, code: true }
    });
    const targetPermissionIds = targetPermissions.map((permission) => permission.id);
    const missingCodes = rolePermissions[roleName].filter(
      (code) => !targetPermissions.some((permission) => permission.code === code)
    );

    if (missingCodes.length) {
      throw new Error(
        `Missing permissions for ${roleName}: ${missingCodes.join(", ")}`
      );
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: { notIn: targetPermissionIds }
      }
    });

    for (const permission of targetPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        create: {
          roleId: role.id,
          permissionId: permission.id
        },
        update: {}
      });
    }
  }

  for (const [code, name, annualAllowance] of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code },
      create: {
        code,
        name,
        annualAllowance,
        isActive: true
      },
      update: {
        name,
        annualAllowance,
        isActive: true
      }
    });
  }

  for (const [code, name, category] of skills) {
    await prisma.skill.upsert({
      where: { code },
      create: {
        code,
        name,
        category,
        isActive: true
      },
      update: {
        name,
        category,
        isActive: true
      }
    });
  }

  const username = process.env.DEFAULT_ADMIN_USERNAME ?? "admin";
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@corehr.local";
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123456";
  const adminPasswordHash = await bcrypt.hash(password, saltRounds);

  const adminUser = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      email,
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      isActive: true
    },
    update: {
      email,
      passwordHash: adminPasswordHash,
      isActive: true,
      deletedAt: null
    }
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    },
    update: {}
  });

  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "SEED_ADMIN",
      entityType: "User",
      entityId: String(adminUser.id),
      newValue: { username, email }
    }
  });

  await seedMockData(adminUser.id, password, saltRounds);
}

async function seedMockData(
  adminUserId: number,
  defaultPassword: string,
  saltRounds: number
) {
  for (const [code, name] of mockDepartments) {
    await prisma.department.upsert({
      where: { code },
      create: { code, name, isActive: true },
      update: { name, isActive: true, deletedAt: null }
    });
  }

  for (const [code, name, departmentCode] of mockPositions) {
    const department = await prisma.department.findUniqueOrThrow({
      where: { code: departmentCode }
    });
    await prisma.position.upsert({
      where: { code },
      create: { code, name, departmentId: department.id, isActive: true },
      update: { name, departmentId: department.id, isActive: true, deletedAt: null }
    });
  }

  for (const [positionCode, skillCodes] of Object.entries(positionSkillMap)) {
    const position = await prisma.position.findUnique({ where: { code: positionCode } });
    if (!position) {
      continue;
    }

    const mappedSkills = await prisma.skill.findMany({
      where: { code: { in: skillCodes } },
      select: { id: true }
    });
    for (const skill of mappedSkills) {
      await prisma.positionSkill.upsert({
        where: {
          positionId_skillId: {
            positionId: position.id,
            skillId: skill.id
          }
        },
        create: {
          positionId: position.id,
          skillId: skill.id
        },
        update: {}
      });
    }
  }

  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
  const employeesByCode = new Map<string, { id: number; userId: number | null }>();

  for (const item of mockUsers) {
    const user = await prisma.user.upsert({
      where: { username: item.username },
      create: {
        username: item.username,
        email: item.email,
        passwordHash,
        mustChangePassword: false,
        isActive: true
      },
      update: {
        email: item.email,
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        deletedAt: null
      }
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { name: item.role } });
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id
        }
      },
      create: {
        userId: user.id,
        roleId: role.id,
        assignedBy: adminUserId
      },
      update: { assignedBy: adminUserId }
    });

    const department = await prisma.department.findUniqueOrThrow({
      where: { code: item.departmentCode }
    });
    const position = await prisma.position.findUniqueOrThrow({
      where: { code: item.positionCode }
    });
    const employee = await prisma.employee.upsert({
      where: { employeeCode: item.employeeCode },
      create: {
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        companyEmail: item.email,
        personalEmail: item.email.replace("@omnihr.local", "@gmail.com"),
        phone: `090${item.employeeCode.slice(-3)}000`,
        birthDate: dateOnly(item.birthDate),
        hireDate: dateOnly(item.hireDate),
        status: EmployeeStatus.ACTIVE,
        departmentId: department.id,
        positionId: position.id,
        careerLevel: item.careerLevel,
        userId: user.id
      },
      update: {
        fullName: item.fullName,
        companyEmail: item.email,
        personalEmail: item.email.replace("@omnihr.local", "@gmail.com"),
        phone: `090${item.employeeCode.slice(-3)}000`,
        birthDate: dateOnly(item.birthDate),
        hireDate: dateOnly(item.hireDate),
        status: EmployeeStatus.ACTIVE,
        departmentId: department.id,
        positionId: position.id,
        careerLevel: item.careerLevel,
        userId: user.id,
        deletedAt: null
      }
    });
    employeesByCode.set(item.employeeCode, {
      id: employee.id,
      userId: employee.userId
    });
  }

  const manager = employeesByCode.get("MGR001");
  if (!manager) {
    throw new Error("Seed manager not found");
  }

  for (const employeeCode of ["EMP001", "EMP002", "EMP003"]) {
    const employee = employeesByCode.get(employeeCode);
    if (!employee) {
      continue;
    }
    await prisma.employeeManager.upsert({
      where: {
        employeeId_managerId_managerType_startDate: {
          employeeId: employee.id,
          managerId: manager.id,
          managerType: ManagerType.DIRECT,
          startDate: dateOnly("2024-01-01")
        }
      },
      create: {
        employeeId: employee.id,
        managerId: manager.id,
        managerType: ManagerType.DIRECT,
        startDate: dateOnly("2024-01-01"),
        isActive: true
      },
      update: {
        endDate: null,
        isActive: true
      }
    });
  }

  for (const [employeeCode, employeeSkills] of Object.entries(mockEmployeeSkills)) {
    const employee = employeesByCode.get(employeeCode);
    if (!employee) {
      continue;
    }
    for (const employeeSkill of employeeSkills) {
      const skill = await prisma.skill.findUniqueOrThrow({
        where: { code: employeeSkill.skillCode }
      });
      await prisma.employeeSkill.upsert({
        where: {
          employeeId_skillId: {
            employeeId: employee.id,
            skillId: skill.id
          }
        },
        create: {
          employeeId: employee.id,
          skillId: skill.id,
          proficiency: employeeSkill.proficiency,
          yearsExperience: employeeSkill.yearsExperience,
          lastUsedAt: dateOnly("2026-05-31"),
          note: "Seeded mock skill"
        },
        update: {
          proficiency: employeeSkill.proficiency,
          yearsExperience: employeeSkill.yearsExperience,
          lastUsedAt: dateOnly("2026-05-31"),
          note: "Seeded mock skill"
        }
      });
    }
  }

  const engineering = await prisma.department.findUniqueOrThrow({
    where: { code: "ENG" }
  });
  const hr = await prisma.department.findUniqueOrThrow({ where: { code: "HR" } });
  const projectCore = await prisma.project.upsert({
    where: { code: "OMNI-CORE" },
    create: {
      code: "OMNI-CORE",
      name: "OmniHR Core Platform",
      description: "Mock project for reviewing Phase 2 task assignment.",
      status: "ACTIVE",
      departmentId: engineering.id,
      managerId: manager.id,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-01"),
      endDate: dateOnly("2026-08-31")
    },
    update: {
      name: "OmniHR Core Platform",
      description: "Mock project for reviewing Phase 2 task assignment.",
      status: "ACTIVE",
      departmentId: engineering.id,
      managerId: manager.id,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-01"),
      endDate: dateOnly("2026-08-31"),
      deletedAt: null
    }
  });
  const projectPeopleOps = await prisma.project.upsert({
    where: { code: "OMNI-OPS" },
    create: {
      code: "OMNI-OPS",
      name: "People Operations Setup",
      description: "Mock HR operations project.",
      status: "PLANNING",
      departmentId: hr.id,
      managerId: manager.id,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-15"),
      endDate: dateOnly("2026-07-31")
    },
    update: {
      name: "People Operations Setup",
      description: "Mock HR operations project.",
      status: "PLANNING",
      departmentId: hr.id,
      managerId: manager.id,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-15"),
      endDate: dateOnly("2026-07-31"),
      deletedAt: null
    }
  });

  const taskApi = await upsertMockTask({
    title: "Build task assignment API",
    description: "Implement backend endpoints for task assignment and history.",
    projectId: projectCore.id,
    departmentId: engineering.id,
    assigneeCode: "EMP002",
    priority: TaskPriority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    startDate: "2026-06-03",
    dueDate: "2026-06-18",
    estimatedHours: 24,
    requiredSkills: [
      { code: "NESTJS", proficiency: SkillProficiency.ADVANCED, importance: TaskSkillImportance.REQUIRED },
      { code: "PRISMA", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.IMPORTANT },
      { code: "POSTGRESQL", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.IMPORTANT }
    ],
    employeesByCode,
    adminUserId
  });
  await upsertMockTask({
    title: "Design manager task board",
    description: "Create React UI for managers to review workload and assign tasks.",
    projectId: projectCore.id,
    departmentId: engineering.id,
    assigneeCode: "EMP001",
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TODO,
    startDate: "2026-06-05",
    dueDate: "2026-06-24",
    estimatedHours: 18,
    requiredSkills: [
      { code: "REACT", proficiency: SkillProficiency.ADVANCED, importance: TaskSkillImportance.REQUIRED },
      { code: "TYPESCRIPT", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.IMPORTANT },
      { code: "UI_UX", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.NICE_TO_HAVE }
    ],
    employeesByCode,
    adminUserId
  });
  await upsertMockTask({
    title: "Prepare regression test checklist",
    description: "Verify leave, attendance, auth, task, and AI suggestion flows.",
    projectId: projectCore.id,
    departmentId: engineering.id,
    assigneeCode: "EMP003",
    priority: TaskPriority.HIGH,
    status: TaskStatus.IN_REVIEW,
    startDate: "2026-06-04",
    dueDate: "2026-06-12",
    estimatedHours: 12,
    requiredSkills: [
      { code: "TESTING", proficiency: SkillProficiency.ADVANCED, importance: TaskSkillImportance.REQUIRED },
      { code: "TYPESCRIPT", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.NICE_TO_HAVE }
    ],
    employeesByCode,
    adminUserId
  });
  const taskAi = await upsertMockTask({
    title: "Implement AI assignment score review",
    description: "Open task with no assignee so the AI suggestion screen has useful candidates.",
    projectId: projectCore.id,
    departmentId: engineering.id,
    assigneeCode: null,
    priority: TaskPriority.URGENT,
    status: TaskStatus.TODO,
    startDate: "2026-06-10",
    dueDate: "2026-06-20",
    estimatedHours: 20,
    requiredSkills: [
      { code: "NESTJS", proficiency: SkillProficiency.ADVANCED, importance: TaskSkillImportance.REQUIRED },
      { code: "TYPESCRIPT", proficiency: SkillProficiency.ADVANCED, importance: TaskSkillImportance.IMPORTANT },
      { code: "TESTING", proficiency: SkillProficiency.INTERMEDIATE, importance: TaskSkillImportance.NICE_TO_HAVE }
    ],
    employeesByCode,
    adminUserId
  });
  await upsertMockTask({
    title: "Collect HR onboarding policy notes",
    description: "Small HR task for cross-department data visibility.",
    projectId: projectPeopleOps.id,
    departmentId: hr.id,
    assigneeCode: "EMP004",
    priority: TaskPriority.LOW,
    status: TaskStatus.TODO,
    startDate: "2026-06-16",
    dueDate: "2026-06-30",
    estimatedHours: 8,
    requiredSkills: [{ code: "TESTING", proficiency: SkillProficiency.BEGINNER, importance: TaskSkillImportance.NICE_TO_HAVE }],
    employeesByCode,
    adminUserId
  });

  await ensureTaskAssignment(taskApi.id, employeesByCode.get("EMP002")?.id, adminUserId, "Seeded manual assignment");
  await seedLeaveAndAttendance(employeesByCode, adminUserId);
  await seedAiSuggestion(taskAi.id, adminUserId, employeesByCode);

  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: "SEED_MOCK_DATA",
      entityType: "System",
      entityId: "mock-phase2",
      newValue: {
        users: mockUsers.map((item) => item.username),
        projects: ["OMNI-CORE", "OMNI-OPS"]
      }
    }
  });
}

async function upsertMockTask(input: {
  title: string;
  description: string;
  projectId: number;
  departmentId: number;
  assigneeCode: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  requiredSkills: Array<{
    code: string;
    proficiency: SkillProficiency;
    importance: TaskSkillImportance;
  }>;
  employeesByCode: Map<string, { id: number; userId: number | null }>;
  adminUserId: number;
}) {
  const assigneeId = input.assigneeCode
    ? input.employeesByCode.get(input.assigneeCode)?.id
    : null;
  const existing = await prisma.task.findFirst({
    where: {
      title: input.title,
      projectId: input.projectId
    }
  });
  const task = existing
    ? await prisma.task.update({
        where: { id: existing.id },
        data: {
          description: input.description,
          projectId: input.projectId,
          departmentId: input.departmentId,
          assigneeId,
          assignedByUserId: assigneeId ? input.adminUserId : null,
          priority: input.priority,
          status: input.status,
          startDate: dateOnly(input.startDate),
          dueDate: dateOnly(input.dueDate),
          estimatedHours: input.estimatedHours,
          actualHours: input.status === TaskStatus.DONE ? input.estimatedHours : 0,
          completedAt: input.status === TaskStatus.DONE ? new Date() : null,
          deletedAt: null
        }
      })
    : await prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          projectId: input.projectId,
          departmentId: input.departmentId,
          assigneeId,
          createdByUserId: input.adminUserId,
          assignedByUserId: assigneeId ? input.adminUserId : null,
          priority: input.priority,
          status: input.status,
          startDate: dateOnly(input.startDate),
          dueDate: dateOnly(input.dueDate),
          estimatedHours: input.estimatedHours,
          actualHours: input.status === TaskStatus.DONE ? input.estimatedHours : 0,
          completedAt: input.status === TaskStatus.DONE ? new Date() : null
        }
      });

  await prisma.taskRequiredSkill.deleteMany({ where: { taskId: task.id } });
  for (const requiredSkill of input.requiredSkills) {
    const skill = await prisma.skill.findUniqueOrThrow({
      where: { code: requiredSkill.code }
    });
    await prisma.taskRequiredSkill.create({
      data: {
        taskId: task.id,
        skillId: skill.id,
        requiredProficiency: requiredSkill.proficiency,
        importance: requiredSkill.importance
      }
    });
  }

  if (assigneeId) {
    await ensureTaskAssignment(task.id, assigneeId, input.adminUserId, "Seeded manual assignment");
  }

  return task;
}

async function ensureTaskAssignment(
  taskId: number,
  assigneeId: number | undefined,
  adminUserId: number,
  note: string
) {
  if (!assigneeId) {
    return;
  }
  const existing = await prisma.taskAssignment.findFirst({
    where: {
      taskId,
      assigneeId,
      assignmentType: TaskAssignmentType.MANUAL
    }
  });
  if (!existing) {
    await prisma.taskAssignment.create({
      data: {
        taskId,
        assigneeId,
        assignedByUserId: adminUserId,
        assignmentType: TaskAssignmentType.MANUAL,
        note
      }
    });
  }
}

async function seedLeaveAndAttendance(
  employeesByCode: Map<string, { id: number; userId: number | null }>,
  adminUserId: number
) {
  const annualLeave = await prisma.leaveType.findUniqueOrThrow({
    where: { code: "ANNUAL_LEAVE" }
  });
  const employeeOnLeave = employeesByCode.get("EMP003");
  if (employeeOnLeave) {
    const existingLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employeeOnLeave.id,
        startDate: dateOnly("2026-06-18"),
        endDate: dateOnly("2026-06-19")
      }
    });
    if (existingLeave) {
      await prisma.leaveRequest.update({
        where: { id: existingLeave.id },
        data: {
          leaveTypeId: annualLeave.id,
          totalDays: 2,
          reason: "Seeded approved leave to test AI availability score",
          status: LeaveRequestStatus.APPROVED,
          approverUserId: adminUserId,
          approvedAt: new Date(),
          rejectionReason: null,
          canceledAt: null
        }
      });
    } else {
      await prisma.leaveRequest.create({
        data: {
          employeeId: employeeOnLeave.id,
          leaveTypeId: annualLeave.id,
          startDate: dateOnly("2026-06-18"),
          endDate: dateOnly("2026-06-19"),
          totalDays: 2,
          reason: "Seeded approved leave to test AI availability score",
          status: LeaveRequestStatus.APPROVED,
          approverUserId: adminUserId,
          approvedAt: new Date()
        }
      });
    }
  }

  for (const employeeCode of ["EMP001", "EMP002", "EMP003"]) {
    const employee = employeesByCode.get(employeeCode);
    if (!employee) {
      continue;
    }
    await ensureAttendanceRecord(employee.id, "2026-06-09", AttendanceRecordType.CHECK_IN, "08:30");
    await ensureAttendanceRecord(employee.id, "2026-06-09", AttendanceRecordType.CHECK_OUT, "17:45");
  }
}

async function ensureAttendanceRecord(
  employeeId: number,
  workDate: string,
  recordType: AttendanceRecordType,
  time: string
) {
  const existing = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      workDate: dateOnly(workDate),
      recordType
    }
  });
  const recordedAt = new Date(`${workDate}T${time}:00.000+07:00`);
  if (existing) {
    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        recordedAt,
        source: "SEED",
        note: "Seeded mock attendance",
        isAdjustment: false
      }
    });
  } else {
    await prisma.attendanceRecord.create({
      data: {
        employeeId,
        workDate: dateOnly(workDate),
        recordType,
        recordedAt,
        source: "SEED",
        note: "Seeded mock attendance",
        isAdjustment: false
      }
    });
  }
}

async function seedAiSuggestion(
  taskId: number,
  adminUserId: number,
  employeesByCode: Map<string, { id: number; userId: number | null }>
) {
  const existing = await prisma.aiTaskSuggestion.findFirst({
    where: {
      taskId,
      requestedByUserId: adminUserId
    }
  });
  if (existing) {
    return;
  }

  const candidates = [
    {
      employeeCode: "EMP002",
      rank: 1,
      score: 86,
      skillScore: 92,
      workloadScore: 72,
      availabilityScore: 100,
      reason: "Backend skills match strongly, workload is moderate, no overlapping leave."
    },
    {
      employeeCode: "MGR001",
      rank: 2,
      score: 78,
      skillScore: 84,
      workloadScore: 75,
      availabilityScore: 100,
      reason: "Strong technical background, but better reserved for review and coordination."
    },
    {
      employeeCode: "EMP003",
      rank: 3,
      score: 63,
      skillScore: 67,
      workloadScore: 80,
      availabilityScore: 40,
      reason: "Testing skill is useful, but approved leave overlaps the task window."
    }
  ];

  await prisma.aiTaskSuggestion.create({
    data: {
      taskId,
      requestedByUserId: adminUserId,
      algorithmVersion: "rule-based-v1",
      status: AiTaskSuggestionStatus.GENERATED,
      inputSnapshot: {
        seed: true,
        note: "Mock suggestion seeded for UI review"
      },
      items: {
        create: candidates
          .map((candidate) => ({
            ...candidate,
            employeeId: employeesByCode.get(candidate.employeeCode)?.id
          }))
          .filter((candidate): candidate is typeof candidate & { employeeId: number } =>
            Boolean(candidate.employeeId)
          )
          .map((candidate) => ({
            employeeId: candidate.employeeId,
            rank: candidate.rank,
            score: candidate.score,
            skillScore: candidate.skillScore,
            workloadScore: candidate.workloadScore,
            availabilityScore: candidate.availabilityScore,
            reason: candidate.reason,
            selected: false
          }))
      }
    }
  });
}

function dateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  return new Date(`${value}T00:00:00.000Z`);
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
