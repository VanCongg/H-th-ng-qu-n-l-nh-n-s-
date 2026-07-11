import "dotenv/config";
import {
  CareerLevel,
  EmployeeStatus,
  LeaveRequestStatus,
  ManagerType,
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

const prisma = new PrismaClient();

const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@123456";
const seedStartDate = "2026-06-01";
const projectCode = "IT-AI-LARGE";

const roles = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;

const permissions = [
  "EMPLOYEE_READ_ALL",
  "EMPLOYEE_READ_TEAM",
  "EMPLOYEE_READ_SELF",
  "EMPLOYEE_UPDATE_SELF",
  "DEPARTMENT_READ",
  "TEAM_READ",
  "TEAM_CREATE",
  "TEAM_UPDATE",
  "POSITION_READ",
  "MANAGER_READ",
  "PROJECT_CREATE",
  "PROJECT_READ_ALL",
  "PROJECT_READ_TEAM",
  "PROJECT_UPDATE",
  "TASK_CREATE",
  "TASK_READ_ALL",
  "TASK_READ_TEAM",
  "TASK_READ_SELF",
  "TASK_UPDATE",
  "TASK_ASSIGN",
  "TASK_UPDATE_STATUS",
  "SKILL_READ",
  "EMPLOYEE_SKILL_READ",
  "AI_TASK_SUGGEST",
  "AI_TASK_SELECT",
  "TASK_ASSIGNMENT_READ",
  "LEAVE_TYPE_READ",
  "LEAVE_CREATE",
  "LEAVE_READ_TEAM",
  "LEAVE_READ_SELF",
  "LEAVE_APPROVE",
  "LEAVE_REJECT"
] as const;

const rolePermissions: Record<(typeof roles)[number], readonly string[]> = {
  ADMIN: permissions,
  MANAGER: [
    "EMPLOYEE_READ_TEAM",
    "EMPLOYEE_READ_SELF",
    "EMPLOYEE_UPDATE_SELF",
    "DEPARTMENT_READ",
    "TEAM_READ",
    "TEAM_CREATE",
    "TEAM_UPDATE",
    "POSITION_READ",
    "MANAGER_READ",
    "PROJECT_CREATE",
    "PROJECT_READ_TEAM",
    "PROJECT_UPDATE",
    "TASK_CREATE",
    "TASK_READ_TEAM",
    "TASK_READ_SELF",
    "TASK_UPDATE",
    "TASK_ASSIGN",
    "TASK_UPDATE_STATUS",
    "SKILL_READ",
    "EMPLOYEE_SKILL_READ",
    "AI_TASK_SUGGEST",
    "AI_TASK_SELECT",
    "TASK_ASSIGNMENT_READ",
    "LEAVE_TYPE_READ",
    "LEAVE_CREATE",
    "LEAVE_READ_TEAM",
    "LEAVE_READ_SELF",
    "LEAVE_APPROVE",
    "LEAVE_REJECT"
  ],
  EMPLOYEE: [
    "EMPLOYEE_READ_SELF",
    "EMPLOYEE_UPDATE_SELF",
    "TASK_READ_SELF",
    "TASK_UPDATE_STATUS",
    "EMPLOYEE_SKILL_READ",
    "LEAVE_TYPE_READ",
    "LEAVE_CREATE",
    "LEAVE_READ_SELF"
  ]
};

const skillCatalog = [
  ["ACTIVE_DIRECTORY", "Active Directory", "Infrastructure"],
  ["AGILE_SCRUM", "Agile/Scrum", "Management"],
  ["AIRFLOW", "Apache Airflow", "Data"],
  ["ANDROID", "Android", "Mobile"],
  ["API_TESTING", "API Testing", "Quality"],
  ["AUTOMATION_TESTING", "Automation Testing", "Quality"],
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
  ["DOCKER", "Docker", "DevOps"],
  ["DOCUMENTATION", "Documentation", "Business Analysis"],
  ["EXPRESS", "Express.js", "Backend"],
  ["FIGMA", "Figma", "Design"],
  ["FIREBASE", "Firebase", "Mobile"],
  ["FLUTTER", "Flutter", "Mobile"],
  ["GCP", "Google Cloud Platform", "Cloud"],
  ["GIT", "Git", "Engineering"],
  ["GITHUB_ACTIONS", "GitHub Actions", "DevOps"],
  ["GITLAB_CI", "GitLab CI", "DevOps"],
  ["GRAFANA", "Grafana", "DevOps"],
  ["GRAPHQL", "GraphQL", "Backend"],
  ["HARDWARE", "Hardware Support", "IT Support"],
  ["HELPDESK", "Helpdesk", "IT Support"],
  ["HTML", "HTML", "Frontend"],
  ["IAM", "Identity & Access Management", "Security"],
  ["IOS", "iOS", "Mobile"],
  ["JAVASCRIPT", "JavaScript", "Frontend"],
  ["KAFKA", "Kafka", "Backend"],
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
  ["VUE", "Vue.js", "Frontend"],
  ["VULNERABILITY_ASSESSMENT", "Vulnerability Assessment", "Security"],
  ["WINDOWS_SERVER", "Windows Server", "Infrastructure"]
] as const;

const positions = [
  ["IT_MANAGER", "Trưởng phòng Công nghệ thông tin"],
  ["PRODUCT_OWNER", "Product Owner"],
  ["SCRUM_MASTER", "Scrum Master"],
  ["BUSINESS_ANALYST", "Business Analyst"],
  ["UI_UX_DESIGNER", "UI/UX Designer"],
  ["TECH_LEAD", "Trưởng nhóm kỹ thuật"],
  ["SOFTWARE_ARCHITECT", "Kiến trúc sư phần mềm"],
  ["FE_DEV", "Lập trình viên Frontend"],
  ["BE_DEV", "Lập trình viên Backend"],
  ["FULLSTACK_DEV", "Lập trình viên Fullstack"],
  ["MOBILE_DEV", "Lập trình viên Mobile"],
  ["QA_ENGINEER", "QA Engineer"],
  ["DEVOPS_ENGINEER", "DevOps Engineer"],
  ["DATA_ENGINEER", "Data Engineer"],
  ["DATABASE_ADMIN", "Quản trị cơ sở dữ liệu"],
  ["SECURITY_ENGINEER", "Security Engineer"],
  ["SYSTEM_ADMIN", "Quản trị hệ thống"],
  ["NETWORK_ENGINEER", "Network Engineer"],
  ["IT_SUPPORT", "IT Support"]
] as const;

const positionSkills: Record<string, string[]> = {
  IT_MANAGER: [
    "AGILE_SCRUM",
    "PROJECT_PLANNING",
    "RISK_MANAGEMENT",
    "TEAM_LEADERSHIP",
    "PEOPLE_MANAGEMENT",
    "STAKEHOLDER_MANAGEMENT",
    "ROADMAP"
  ],
  PRODUCT_OWNER: [
    "PRODUCT_DISCOVERY",
    "ROADMAP",
    "REQUIREMENT_ANALYSIS",
    "USER_STORY",
    "STAKEHOLDER_MANAGEMENT",
    "AGILE_SCRUM"
  ],
  SCRUM_MASTER: [
    "AGILE_SCRUM",
    "PROJECT_PLANNING",
    "RISK_MANAGEMENT",
    "TEAM_LEADERSHIP",
    "STAKEHOLDER_MANAGEMENT"
  ],
  BUSINESS_ANALYST: [
    "REQUIREMENT_ANALYSIS",
    "BPMN",
    "USER_STORY",
    "AGILE_SCRUM",
    "STAKEHOLDER_MANAGEMENT",
    "DOCUMENTATION"
  ],
  UI_UX_DESIGNER: [
    "FIGMA",
    "UI_UX",
    "HTML",
    "CSS",
    "PRODUCT_DISCOVERY",
    "REQUIREMENT_ANALYSIS"
  ],
  TECH_LEAD: [
    "SYSTEM_DESIGN",
    "DESIGN_PATTERNS",
    "CODE_REVIEW",
    "SOLID",
    "MICROSERVICES",
    "TYPESCRIPT",
    "DOCKER",
    "TEAM_LEADERSHIP"
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
    "PLAYWRIGHT",
    "TESTING"
  ],
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
    "TYPESCRIPT"
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
    "DOCKER"
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
    "MOBILE_CI_CD"
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
  DATA_ENGINEER: [
    "SQL",
    "PYTHON",
    "DATA_MODELING",
    "ETL",
    "AIRFLOW",
    "POSTGRESQL",
    "BIGQUERY",
    "DOCKER",
    "POWER_BI"
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
  SECURITY_ENGINEER: [
    "OWASP",
    "IAM",
    "SIEM",
    "VULNERABILITY_ASSESSMENT",
    "PENETRATION_TESTING",
    "LINUX",
    "NETWORKING"
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
  NETWORK_ENGINEER: [
    "NETWORKING",
    "LINUX",
    "NGINX",
    "VPN",
    "SIEM",
    "BACKUP_RESTORE"
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
  ]
};

type RequiredSkillSeed = {
  code: string;
  proficiency: SkillProficiency;
  importance: TaskSkillImportance;
};

type TeamSeed = {
  order: number;
  code: string;
  name: string;
  description: string;
  leadName: string;
  leadPositionCode: string;
  memberCount: number;
  memberPositionCodes: string[];
  technologies: string[];
  taskArea: string;
  assignedTaskCount: number;
  aiSkillSets: RequiredSkillSeed[][];
};

type EmployeeSeed = {
  employeeCode: string;
  fullName: string;
  positionCode: string;
  careerLevel: CareerLevel;
  roleName: "MANAGER" | "EMPLOYEE";
  seedIndex: number;
  extraSkillCodes: string[];
};

type EmployeeContext = {
  id: number;
  userId: number | null;
  code: string;
  fullName: string;
  positionCode: string;
};

type TeamContext = {
  id: number;
  code: string;
  name: string;
  seed: TeamSeed;
  lead: EmployeeContext;
  members: EmployeeContext[];
};

const teamSeeds: TeamSeed[] = [
  {
    order: 1,
    code: "IT-BA",
    name: "BA & Product",
    description: "Phân tích nghiệp vụ, discovery, user story và quản lý roadmap.",
    leadName: "Phạm Hồng Sơn",
    leadPositionCode: "PRODUCT_OWNER",
    memberCount: 14,
    memberPositionCodes: [
      "BUSINESS_ANALYST",
      "BUSINESS_ANALYST",
      "BUSINESS_ANALYST",
      "PRODUCT_OWNER",
      "SCRUM_MASTER",
      "UI_UX_DESIGNER"
    ],
    technologies: ["Jira", "Confluence", "Figma", "BPMN"],
    taskArea: "nghiệp vụ và đặc tả",
    assignedTaskCount: 22,
    aiSkillSets: [
      [
        required("REQUIREMENT_ANALYSIS", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("BPMN", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("USER_STORY", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("PRODUCT_DISCOVERY", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("STAKEHOLDER_MANAGEMENT", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("DOCUMENTATION", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 2,
    code: "IT-FE",
    name: "Frontend Web",
    description: "Xây dựng UI web, design system, dashboard và trải nghiệm quản trị.",
    leadName: "Trần Quỳnh Anh",
    leadPositionCode: "TECH_LEAD",
    memberCount: 16,
    memberPositionCodes: ["FE_DEV", "FE_DEV", "FE_DEV", "FULLSTACK_DEV", "UI_UX_DESIGNER"],
    technologies: ["React", "TypeScript", "Mantine", "Vite", "Playwright"],
    taskArea: "frontend web",
    assignedTaskCount: 26,
    aiSkillSets: [
      [
        required("REACT", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("TYPESCRIPT", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("PLAYWRIGHT", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ],
      [
        required("NEXTJS", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("TAILWIND", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("UI_UX", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 3,
    code: "IT-BE",
    name: "Backend API",
    description: "Thiết kế API, domain service, phân quyền và tích hợp dữ liệu.",
    leadName: "Lê Đức Nam",
    leadPositionCode: "TECH_LEAD",
    memberCount: 20,
    memberPositionCodes: ["BE_DEV", "BE_DEV", "BE_DEV", "FULLSTACK_DEV", "SOFTWARE_ARCHITECT", "DATABASE_ADMIN"],
    technologies: ["NestJS", "Prisma", "PostgreSQL", "Redis", "RabbitMQ"],
    taskArea: "backend API",
    assignedTaskCount: 34,
    aiSkillSets: [
      [
        required("NESTJS", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("TYPESCRIPT", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("POSTGRESQL", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("PRISMA", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ],
      [
        required("SYSTEM_DESIGN", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("REST_API", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("REDIS", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 4,
    code: "IT-QA",
    name: "QA & Automation",
    description: "Kiểm thử thủ công, tự động hóa, API test và regression.",
    leadName: "Võ Minh Châu",
    leadPositionCode: "QA_ENGINEER",
    memberCount: 14,
    memberPositionCodes: ["QA_ENGINEER", "QA_ENGINEER", "QA_ENGINEER", "BUSINESS_ANALYST"],
    technologies: ["Playwright", "Selenium", "Postman", "k6"],
    taskArea: "kiểm thử chất lượng",
    assignedTaskCount: 24,
    aiSkillSets: [
      [
        required("AUTOMATION_TESTING", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("API_TESTING", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("PLAYWRIGHT", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("PERFORMANCE_TESTING", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("TESTING", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("SELENIUM", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 5,
    code: "IT-DEVOPS",
    name: "DevOps & SRE",
    description: "CI/CD, hạ tầng cloud, container, monitoring và vận hành.",
    leadName: "Đặng Quốc Bảo",
    leadPositionCode: "DEVOPS_ENGINEER",
    memberCount: 10,
    memberPositionCodes: ["DEVOPS_ENGINEER", "DEVOPS_ENGINEER", "SYSTEM_ADMIN", "NETWORK_ENGINEER"],
    technologies: ["Docker", "Kubernetes", "GitHub Actions", "Terraform", "Prometheus"],
    taskArea: "hạ tầng DevOps",
    assignedTaskCount: 20,
    aiSkillSets: [
      [
        required("KUBERNETES", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("DOCKER", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("CI_CD", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("TERRAFORM", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("AWS", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("GRAFANA", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 6,
    code: "IT-DATA",
    name: "Data & AI",
    description: "Pipeline dữ liệu, báo cáo BI, scoring và thử nghiệm AI nội bộ.",
    leadName: "Nguyễn Mai Phương",
    leadPositionCode: "DATA_ENGINEER",
    memberCount: 12,
    memberPositionCodes: ["DATA_ENGINEER", "DATA_ENGINEER", "DATABASE_ADMIN", "BE_DEV"],
    technologies: ["Python", "Airflow", "PostgreSQL", "BigQuery", "Power BI"],
    taskArea: "dữ liệu và AI",
    assignedTaskCount: 20,
    aiSkillSets: [
      [
        required("PYTHON", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("SQL", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("AIRFLOW", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("DATA_MODELING", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("ETL", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("POWER_BI", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 7,
    code: "IT-MOBILE",
    name: "Mobile App",
    description: "Ứng dụng mobile, đồng bộ API, offline cache và release store.",
    leadName: "Hoàng Anh Tuấn",
    leadPositionCode: "MOBILE_DEV",
    memberCount: 10,
    memberPositionCodes: ["MOBILE_DEV", "MOBILE_DEV", "FULLSTACK_DEV", "QA_ENGINEER"],
    technologies: ["Flutter", "Dart", "Android", "iOS", "Firebase"],
    taskArea: "mobile app",
    assignedTaskCount: 18,
    aiSkillSets: [
      [
        required("FLUTTER", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("DART", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT),
        required("REST_API", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("MOBILE_CI_CD", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("FIREBASE", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("ANDROID", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 8,
    code: "IT-SEC",
    name: "Security & Infrastructure",
    description: "Bảo mật ứng dụng, IAM, SIEM, đánh giá lỗ hổng và mạng nội bộ.",
    leadName: "Bùi Hải Long",
    leadPositionCode: "SECURITY_ENGINEER",
    memberCount: 9,
    memberPositionCodes: ["SECURITY_ENGINEER", "SECURITY_ENGINEER", "NETWORK_ENGINEER", "SYSTEM_ADMIN"],
    technologies: ["OWASP", "IAM", "SIEM", "VPN", "Linux"],
    taskArea: "bảo mật và hạ tầng",
    assignedTaskCount: 18,
    aiSkillSets: [
      [
        required("OWASP", SkillProficiency.ADVANCED, TaskSkillImportance.REQUIRED),
        required("IAM", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("SIEM", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("VULNERABILITY_ASSESSMENT", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("NETWORKING", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("LINUX", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  },
  {
    order: 9,
    code: "IT-SUPPORT",
    name: "IT Support",
    description: "Helpdesk, tài khoản, thiết bị, M365 và hỗ trợ người dùng.",
    leadName: "Đỗ Khánh Linh",
    leadPositionCode: "IT_SUPPORT",
    memberCount: 10,
    memberPositionCodes: ["IT_SUPPORT", "IT_SUPPORT", "SYSTEM_ADMIN", "NETWORK_ENGINEER"],
    technologies: ["M365", "Active Directory", "Windows Server", "VPN"],
    taskArea: "hỗ trợ IT nội bộ",
    assignedTaskCount: 18,
    aiSkillSets: [
      [
        required("ACTIVE_DIRECTORY", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("M365", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("HELPDESK", SkillProficiency.ADVANCED, TaskSkillImportance.IMPORTANT)
      ],
      [
        required("NETWORKING", SkillProficiency.INTERMEDIATE, TaskSkillImportance.REQUIRED),
        required("VPN", SkillProficiency.INTERMEDIATE, TaskSkillImportance.IMPORTANT),
        required("BACKUP_RESTORE", SkillProficiency.INTERMEDIATE, TaskSkillImportance.NICE_TO_HAVE)
      ]
    ]
  }
];

async function main() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  const adminUserId = await ensureBaseAuth(passwordHash);
  await ensureSkillCatalog();

  const department = await prisma.department.upsert({
    where: { code: "IT" },
    create: {
      code: "IT",
      name: "Công nghệ thông tin",
      isActive: true
    },
    update: {
      name: "Công nghệ thông tin",
      isActive: true,
      deletedAt: null
    }
  });

  await ensurePositions(department.id);

  const departmentHead = await ensureEmployee(
    {
      employeeCode: "IT0001",
      fullName: "Nguyễn Hoàng Minh",
      positionCode: "IT_MANAGER",
      careerLevel: CareerLevel.LEAD,
      roleName: "MANAGER",
      seedIndex: 1,
      extraSkillCodes: [
        "TEAM_LEADERSHIP",
        "PROJECT_PLANNING",
        "RISK_MANAGEMENT",
        "STAKEHOLDER_MANAGEMENT",
        "AGILE_SCRUM"
      ]
    },
    department.id,
    passwordHash,
    adminUserId
  );

  await prisma.department.update({
    where: { id: department.id },
    data: { managerId: departmentHead.id }
  });

  const teamContexts: TeamContext[] = [];
  for (const seed of teamSeeds) {
    const lead = await ensureEmployee(
      {
        employeeCode: employeeCode(seed.order, 1),
        fullName: seed.leadName,
        positionCode: seed.leadPositionCode,
        careerLevel: CareerLevel.LEAD,
        roleName: "MANAGER",
        seedIndex: seed.order * 100 + 1,
        extraSkillCodes: [
          ...skillCodesFromTechnologies(seed.technologies),
          "TEAM_LEADERSHIP",
          "AGILE_SCRUM",
          "PROJECT_PLANNING"
        ]
      },
      department.id,
      passwordHash,
      adminUserId
    );

    const team = await prisma.team.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        description: seed.description,
        departmentId: department.id,
        leadId: lead.id,
        isActive: true
      },
      update: {
        name: seed.name,
        description: seed.description,
        departmentId: department.id,
        leadId: lead.id,
        isActive: true,
        deletedAt: null
      }
    });

    await ensureTeamMember(team.id, lead.id, TeamMemberRole.LEAD);
    await ensureManagerRelation(lead.id, departmentHead.id);

    const members: EmployeeContext[] = [];
    for (let index = 0; index < seed.memberCount; index += 1) {
      const positionCode =
        seed.memberPositionCodes[index % seed.memberPositionCodes.length];
      const careerLevel = careerLevelFor(index);
      const member = await ensureEmployee(
        {
          employeeCode: employeeCode(seed.order, index + 2),
          fullName: generatedName(seed.order * 100 + index),
          positionCode,
          careerLevel,
          roleName: "EMPLOYEE",
          seedIndex: seed.order * 100 + index + 2,
          extraSkillCodes: skillCodesFromTechnologies(seed.technologies)
        },
        department.id,
        passwordHash,
        adminUserId
      );
      await ensureTeamMember(team.id, member.id, TeamMemberRole.MEMBER);
      await ensureManagerRelation(member.id, lead.id);
      await ensureManagerRelation(member.id, departmentHead.id);
      members.push(member);
    }

    teamContexts.push({
      id: team.id,
      code: team.code,
      name: team.name,
      seed,
      lead,
      members
    });
  }

  await seedLeaveData(teamContexts, adminUserId);
  const project = await seedProject(department.id, departmentHead.id, adminUserId);
  const taskCounts = await seedTasks(project.id, department.id, adminUserId, teamContexts);

  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: "SEED_AI_LARGE_DATA",
      entityType: "Project",
      entityId: project.code,
      newValue: {
        department: "IT",
        project: project.code,
        teams: teamContexts.length,
        employees:
          1 +
          teamContexts.length +
          teamContexts.reduce((total, team) => total + team.members.length, 0),
        ...taskCounts
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        department: "IT - Công nghệ thông tin",
        manager: departmentHead.fullName,
        project: `${project.code} - ${project.name}`,
        teams: teamContexts.length,
        employees:
          1 +
          teamContexts.length +
          teamContexts.reduce((total, team) => total + team.members.length, 0),
        ...taskCounts,
        managerLogin: {
          username: departmentHead.code.toLowerCase(),
          password: defaultPassword
        }
      },
      null,
      2
    )
  );
}

async function ensureBaseAuth(passwordHash: string) {
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        description: `${roleName} role`,
        isSystem: true
      },
      update: {
        description: `${roleName} role`,
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
      select: { id: true }
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

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@corehr.local",
      passwordHash,
      mustChangePassword: false,
      isActive: true
    },
    update: {
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      deletedAt: null
    }
  });
  await ensureUserRole(adminUser.id, "ADMIN");
  return adminUser.id;
}

async function ensureSkillCatalog() {
  for (const [code, name, category] of skillCatalog) {
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
}

async function ensurePositions(departmentId: number) {
  for (const [code, name] of positions) {
    const position = await prisma.position.upsert({
      where: { code },
      create: {
        code,
        name,
        departmentId,
        isActive: true
      },
      update: {
        name,
        departmentId,
        isActive: true,
        deletedAt: null
      }
    });

    for (const skillCode of positionSkills[code] ?? []) {
      const skill = await prisma.skill.findUniqueOrThrow({ where: { code: skillCode } });
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
}

async function ensureEmployee(
  seed: EmployeeSeed,
  departmentId: number,
  passwordHash: string,
  adminUserId: number
): Promise<EmployeeContext> {
  const username = seed.employeeCode.toLowerCase();
  const email = `${username}@omnihr.local`;
  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      email,
      passwordHash,
      mustChangePassword: false,
      isActive: true
    },
    update: {
      email,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      deletedAt: null
    }
  });
  await ensureUserRole(user.id, seed.roleName, adminUserId);

  const position = await prisma.position.findUniqueOrThrow({
    where: { code: seed.positionCode }
  });
  const employee = await prisma.employee.upsert({
    where: { employeeCode: seed.employeeCode },
    create: {
      employeeCode: seed.employeeCode,
      fullName: seed.fullName,
      companyEmail: email,
      personalEmail: `${username}@example.com`,
      phone: phoneFor(seed.seedIndex),
      birthDate: birthDateFor(seed.seedIndex),
      hireDate: hireDateFor(seed.seedIndex),
      status: EmployeeStatus.ACTIVE,
      departmentId,
      positionId: position.id,
      careerLevel: seed.careerLevel,
      userId: user.id
    },
    update: {
      fullName: seed.fullName,
      companyEmail: email,
      personalEmail: `${username}@example.com`,
      phone: phoneFor(seed.seedIndex),
      birthDate: birthDateFor(seed.seedIndex),
      hireDate: hireDateFor(seed.seedIndex),
      status: EmployeeStatus.ACTIVE,
      departmentId,
      positionId: position.id,
      careerLevel: seed.careerLevel,
      userId: user.id,
      deletedAt: null
    }
  });

  await ensureEmployeeSkills(
    employee.id,
    seed.positionCode,
    seed.careerLevel,
    seed.extraSkillCodes,
    seed.seedIndex
  );

  return {
    id: employee.id,
    userId: employee.userId,
    code: employee.employeeCode,
    fullName: employee.fullName,
    positionCode: seed.positionCode
  };
}

async function ensureUserRole(
  userId: number,
  roleName: (typeof roles)[number],
  assignedBy?: number
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id
      }
    },
    create: {
      userId,
      roleId: role.id,
      assignedBy
    },
    update: {
      assignedBy
    }
  });
}

async function ensureEmployeeSkills(
  employeeId: number,
  positionCode: string,
  careerLevel: CareerLevel,
  extraSkillCodes: string[],
  seedIndex: number
) {
  const desiredSkillCodes = unique([
    "GIT",
    ...(positionSkills[positionCode] ?? []),
    ...extraSkillCodes
  ]).slice(0, careerLevel === CareerLevel.LEAD ? 12 : 9);

  for (let index = 0; index < desiredSkillCodes.length; index += 1) {
    const skillCode = desiredSkillCodes[index];
    const skill = await prisma.skill.findUnique({ where: { code: skillCode } });
    if (!skill) {
      continue;
    }
    const proficiency = proficiencyFor(careerLevel, index, seedIndex);
    await prisma.employeeSkill.upsert({
      where: {
        employeeId_skillId: {
          employeeId,
          skillId: skill.id
        }
      },
      create: {
        employeeId,
        skillId: skill.id,
        proficiency,
        yearsExperience: yearsFor(careerLevel, index, seedIndex),
        lastUsedAt: dateOnly("2026-06-15"),
        note: "Seed AI large dataset"
      },
      update: {
        proficiency,
        yearsExperience: yearsFor(careerLevel, index, seedIndex),
        lastUsedAt: dateOnly("2026-06-15"),
        note: "Seed AI large dataset"
      }
    });
  }
}

async function ensureTeamMember(
  teamId: number,
  employeeId: number,
  role: TeamMemberRole
) {
  const existing = await prisma.teamMember.findFirst({
    where: { teamId, employeeId }
  });
  if (existing) {
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: {
        role,
        joinedAt: dateOnly("2025-01-01"),
        leftAt: null,
        isActive: true
      }
    });
    return;
  }
  await prisma.teamMember.create({
    data: {
      teamId,
      employeeId,
      role,
      joinedAt: dateOnly("2025-01-01"),
      isActive: true
    }
  });
}

async function ensureManagerRelation(employeeId: number, managerId: number) {
  if (employeeId === managerId) {
    return;
  }
  await prisma.employeeManager.upsert({
    where: {
      employeeId_managerId_managerType_startDate: {
        employeeId,
        managerId,
        managerType: ManagerType.DIRECT,
        startDate: dateOnly("2025-01-01")
      }
    },
    create: {
      employeeId,
      managerId,
      managerType: ManagerType.DIRECT,
      startDate: dateOnly("2025-01-01"),
      isActive: true
    },
    update: {
      endDate: null,
      isActive: true
    }
  });
}

async function seedLeaveData(teamContexts: TeamContext[], adminUserId: number) {
  const annualLeave = await prisma.leaveType.upsert({
    where: { code: "ANNUAL_LEAVE" },
    create: {
      code: "ANNUAL_LEAVE",
      name: "Nghỉ phép năm",
      annualAllowance: 12,
      isActive: true
    },
    update: {
      name: "Nghỉ phép năm",
      annualAllowance: 12,
      isActive: true
    }
  });

  for (let index = 0; index < teamContexts.length; index += 1) {
    const team = teamContexts[index];
    const approved = team.members[2];
    const pending = team.members[3];
    if (approved) {
      await upsertLeave({
        employeeId: approved.id,
        leaveTypeId: annualLeave.id,
        startDate: "2026-07-08",
        endDate: "2026-07-10",
        status: LeaveRequestStatus.APPROVED,
        approverUserId: adminUserId,
        reason: `Mock approved leave for AI availability test ${team.code}`
      });
    }
    if (pending) {
      await upsertLeave({
        employeeId: pending.id,
        leaveTypeId: annualLeave.id,
        startDate: index % 2 === 0 ? "2026-07-14" : "2026-07-16",
        endDate: index % 2 === 0 ? "2026-07-15" : "2026-07-17",
        status: LeaveRequestStatus.PENDING,
        approverUserId: null,
        reason: `Mock pending leave for AI availability test ${team.code}`
      });
    }
  }
}

async function upsertLeave(input: {
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  status: LeaveRequestStatus;
  approverUserId: number | null;
  reason: string;
}) {
  const existing = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: input.employeeId,
      startDate: dateOnly(input.startDate),
      endDate: dateOnly(input.endDate)
    }
  });
  const data = {
    leaveTypeId: input.leaveTypeId,
    totalDays: workdayCount(input.startDate, input.endDate),
    reason: input.reason,
    status: input.status,
    approverUserId: input.approverUserId,
    approvedAt:
      input.status === LeaveRequestStatus.APPROVED ? new Date("2026-06-20T02:00:00.000Z") : null,
    rejectionReason: null,
    canceledAt: null
  };
  if (existing) {
    await prisma.leaveRequest.update({
      where: { id: existing.id },
      data
    });
    return;
  }
  await prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      startDate: dateOnly(input.startDate),
      endDate: dateOnly(input.endDate),
      ...data
    }
  });
}

async function seedProject(
  departmentId: number,
  managerId: number,
  adminUserId: number
) {
  return prisma.project.upsert({
    where: { code: projectCode },
    create: {
      code: projectCode,
      name: "Chuyển đổi số nội bộ phòng CNTT 2026",
      description:
        "Project mock lớn để test AI gợi ý chia task: đủ team BA, FE, BE, QA, DevOps, Data, Mobile, Security và Support.",
      status: ProjectStatus.ACTIVE,
      departmentId,
      managerId,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-01"),
      endDate: dateOnly("2026-09-30")
    },
    update: {
      name: "Chuyển đổi số nội bộ phòng CNTT 2026",
      description:
        "Project mock lớn để test AI gợi ý chia task: đủ team BA, FE, BE, QA, DevOps, Data, Mobile, Security và Support.",
      status: ProjectStatus.ACTIVE,
      departmentId,
      managerId,
      createdByUserId: adminUserId,
      startDate: dateOnly("2026-06-01"),
      endDate: dateOnly("2026-09-30"),
      deletedAt: null
    }
  });
}

async function seedTasks(
  projectId: number,
  departmentId: number,
  adminUserId: number,
  teamContexts: TeamContext[]
) {
  let rootTasks = 0;
  let assignedSubtasks = 0;
  let aiTestSubtasks = 0;

  for (const team of teamContexts) {
    const root = await upsertTask({
      title: `[${team.code}] Epic ${team.seed.taskArea}`,
      description: `Task lớn của ${team.name}: ${team.seed.description}`,
      projectId,
      departmentId,
      teamId: team.id,
      parentTaskId: null,
      technologies: team.seed.technologies,
      priority: team.seed.order <= 3 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      assigneeId: null,
      createdByUserId: adminUserId,
      assignedByUserId: null,
      startDate: seedStartDate,
      dueDate: "2026-09-30",
      estimatedHours: null,
      actualHours: 0,
      requiredSkills: []
    });
    rootTasks += 1;

    for (let index = 0; index < team.seed.assignedTaskCount; index += 1) {
      const assignee = chooseAssignee(team, index);
      const status = statusFor(index);
      const estimatedHours = estimatedHoursFor(index);
      const dueDate = dueDateFor(index);
      const task = await upsertTask({
        title: `[${team.code}] ${team.seed.taskArea} - task đã giao ${String(index + 1).padStart(2, "0")}`,
        description: `Subtask đã giao cho ${assignee.fullName}, dùng để tạo workload thực tế cho AI.`,
        projectId,
        departmentId,
        teamId: team.id,
        parentTaskId: root.id,
        technologies: [],
        priority: priorityFor(index),
        status,
        assigneeId: assignee.id,
        createdByUserId: adminUserId,
        assignedByUserId: adminUserId,
        startDate: startDateFor(index),
        dueDate,
        estimatedHours,
        actualHours: status === TaskStatus.DONE ? estimatedHours : index % 4 === 0 ? estimatedHours / 2 : 0,
        requiredSkills: requiredSkillsForTeam(team.seed, index)
      });
      await ensureTaskAssignment(
        task.id,
        assignee.id,
        adminUserId,
        "Seed large AI test dataset: assigned subtask"
      );
      assignedSubtasks += 1;
    }

    for (let index = 0; index < team.seed.aiSkillSets.length; index += 1) {
      await upsertTask({
        title: `[${team.code}] AI TEST - cần gợi ý nhân sự ${index + 1}`,
        description:
          "Subtask cố tình chưa gán người để test AI. Hãy bấm icon gợi ý AI ở màn gán task và so sánh điểm skill/workload/availability.",
        projectId,
        departmentId,
        teamId: team.id,
        parentTaskId: root.id,
        technologies: [],
        priority: index === 0 ? TaskPriority.URGENT : TaskPriority.HIGH,
        status: TaskStatus.TODO,
        assigneeId: null,
        createdByUserId: adminUserId,
        assignedByUserId: null,
        startDate: "2026-07-07",
        dueDate: "2026-07-18",
        estimatedHours: index === 0 ? 18 : 12,
        actualHours: 0,
        requiredSkills: team.seed.aiSkillSets[index]
      });
      aiTestSubtasks += 1;
    }
  }

  return {
    rootTasks,
    assignedSubtasks,
    aiTestSubtasks,
    totalTasks: rootTasks + assignedSubtasks + aiTestSubtasks
  };
}

async function upsertTask(input: {
  title: string;
  description: string;
  projectId: number;
  departmentId: number;
  teamId: number;
  parentTaskId: number | null;
  technologies: string[];
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: number | null;
  createdByUserId: number;
  assignedByUserId: number | null;
  startDate: string;
  dueDate: string;
  estimatedHours: number | null;
  actualHours: number;
  requiredSkills: RequiredSkillSeed[];
}) {
  const completedAt =
    input.status === TaskStatus.DONE ? new Date("2026-06-21T10:00:00.000Z") : null;
  const existing = await prisma.task.findFirst({
    where: {
      title: input.title,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId
    }
  });
  const data = {
    description: input.description,
    projectId: input.projectId,
    departmentId: input.departmentId,
    teamId: input.teamId,
    parentTaskId: input.parentTaskId,
    technologies: input.technologies,
    priority: input.priority,
    status: input.status,
    assigneeId: input.assigneeId,
    createdByUserId: input.createdByUserId,
    assignedByUserId: input.assignedByUserId,
    startDate: dateOnly(input.startDate),
    dueDate: dateOnly(input.dueDate),
    estimatedHours: input.estimatedHours,
    actualHours: input.actualHours,
    completedAt,
    deletedAt: null
  };
  const task = existing
    ? await prisma.task.update({
        where: { id: existing.id },
        data
      })
    : await prisma.task.create({
        data: {
          title: input.title,
          ...data
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
  return task;
}

async function ensureTaskAssignment(
  taskId: number,
  assigneeId: number,
  adminUserId: number,
  note: string
) {
  const existing = await prisma.taskAssignment.findFirst({
    where: {
      taskId,
      assigneeId,
      assignmentType: TaskAssignmentType.MANUAL
    }
  });
  if (existing) {
    return;
  }
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

function required(
  code: string,
  proficiency: SkillProficiency,
  importance: TaskSkillImportance
): RequiredSkillSeed {
  return { code, proficiency, importance };
}

function employeeCode(teamOrder: number, sequence: number) {
  return `IT${String(teamOrder).padStart(2, "0")}${String(sequence).padStart(2, "0")}`;
}

function careerLevelFor(index: number) {
  if (index % 13 === 0) {
    return CareerLevel.SENIOR;
  }
  if (index % 7 === 0) {
    return CareerLevel.JUNIOR;
  }
  if (index % 11 === 0) {
    return CareerLevel.FRESHER;
  }
  return CareerLevel.MIDDLE;
}

function proficiencyFor(
  careerLevel: CareerLevel,
  skillIndex: number,
  seedIndex: number
) {
  if (careerLevel === CareerLevel.LEAD) {
    return skillIndex < 4 ? SkillProficiency.EXPERT : SkillProficiency.ADVANCED;
  }
  if (careerLevel === CareerLevel.SENIOR) {
    return skillIndex < 3 ? SkillProficiency.EXPERT : SkillProficiency.ADVANCED;
  }
  if (careerLevel === CareerLevel.MIDDLE) {
    return skillIndex < 4 ? SkillProficiency.ADVANCED : SkillProficiency.INTERMEDIATE;
  }
  if (careerLevel === CareerLevel.JUNIOR) {
    return skillIndex < 3 ? SkillProficiency.INTERMEDIATE : SkillProficiency.BEGINNER;
  }
  return seedIndex % 5 === 0 ? SkillProficiency.INTERMEDIATE : SkillProficiency.BEGINNER;
}

function yearsFor(careerLevel: CareerLevel, skillIndex: number, seedIndex: number) {
  const base: Record<CareerLevel, number> = {
    INTERN: 0.3,
    FRESHER: 0.8,
    JUNIOR: 1.5,
    MIDDLE: 3,
    SENIOR: 5,
    LEAD: 7
  };
  return Math.max(0.3, base[careerLevel] + ((seedIndex + skillIndex) % 4) * 0.4);
}

function phoneFor(seedIndex: number) {
  return `09${String(10000000 + seedIndex * 37).slice(-8)}`;
}

function birthDateFor(seedIndex: number) {
  const year = 1986 + (seedIndex % 16);
  const month = String((seedIndex % 12) + 1).padStart(2, "0");
  const day = String((seedIndex % 25) + 1).padStart(2, "0");
  return dateOnly(`${year}-${month}-${day}`);
}

function hireDateFor(seedIndex: number) {
  const year = 2020 + (seedIndex % 6);
  const month = String((seedIndex % 12) + 1).padStart(2, "0");
  const day = String((seedIndex % 20) + 1).padStart(2, "0");
  return dateOnly(`${year}-${month}-${day}`);
}

function generatedName(seedIndex: number) {
  const lastNames = [
    "Nguyễn",
    "Trần",
    "Lê",
    "Phạm",
    "Hoàng",
    "Vũ",
    "Võ",
    "Đặng",
    "Bùi",
    "Đỗ",
    "Hồ",
    "Ngô",
    "Dương",
    "Lý"
  ];
  const middleNames = [
    "Minh",
    "Anh",
    "Hải",
    "Thanh",
    "Quốc",
    "Gia",
    "Khánh",
    "Ngọc",
    "Bảo",
    "Hoài",
    "Đức",
    "Tuệ"
  ];
  const firstNames = [
    "An",
    "Bình",
    "Chi",
    "Dũng",
    "Giang",
    "Hà",
    "Hân",
    "Huy",
    "Khoa",
    "Lan",
    "Linh",
    "Long",
    "Mai",
    "Nam",
    "Nhi",
    "Phong",
    "Phúc",
    "Quân",
    "Sơn",
    "Thảo",
    "Trang",
    "Tuấn",
    "Vy",
    "Yến"
  ];
  return `${lastNames[seedIndex % lastNames.length]} ${
    middleNames[(seedIndex * 3) % middleNames.length]
  } ${firstNames[(seedIndex * 5) % firstNames.length]}`;
}

function chooseAssignee(team: TeamContext, taskIndex: number) {
  const preferred = [
    team.members[0],
    team.members[1],
    team.members[0],
    team.members[2],
    team.members[3],
    team.members[1],
    team.members[(taskIndex * 3) % team.members.length],
    team.members[(taskIndex * 5 + 2) % team.members.length]
  ].filter(Boolean);
  if (taskIndex % 11 === 0) {
    return team.lead;
  }
  return preferred[taskIndex % preferred.length] ?? team.lead;
}

function statusFor(taskIndex: number) {
  if (taskIndex % 12 === 0) {
    return TaskStatus.DONE;
  }
  if (taskIndex % 7 === 0) {
    return TaskStatus.IN_REVIEW;
  }
  if (taskIndex % 3 === 0) {
    return TaskStatus.IN_PROGRESS;
  }
  return TaskStatus.TODO;
}

function priorityFor(taskIndex: number) {
  if (taskIndex % 17 === 0) {
    return TaskPriority.URGENT;
  }
  if (taskIndex % 4 === 0) {
    return TaskPriority.HIGH;
  }
  if (taskIndex % 5 === 0) {
    return TaskPriority.LOW;
  }
  return TaskPriority.MEDIUM;
}

function estimatedHoursFor(taskIndex: number) {
  return [3, 4, 6, 8, 10, 12, 16][taskIndex % 7];
}

function startDateFor(taskIndex: number) {
  return dateStringFromOffset(taskIndex % 21);
}

function dueDateFor(taskIndex: number) {
  return dateStringFromOffset(9 + (taskIndex % 48));
}

function dateStringFromOffset(offset: number) {
  const date = new Date("2026-06-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function requiredSkillsForTeam(seed: TeamSeed, taskIndex: number) {
  const skillSet = seed.aiSkillSets[taskIndex % seed.aiSkillSets.length];
  if (taskIndex % 6 === 0) {
    return skillSet;
  }
  return skillSet.slice(0, Math.max(2, skillSet.length - 1));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function dateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function workdayCount(startDate: string, endDate: string) {
  let count = 0;
  const current = dateOnly(startDate);
  const end = dateOnly(endDate);
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

function skillCodesFromTechnologies(technologies: string[]) {
  const map: Record<string, string[]> = {
    "Active Directory": ["ACTIVE_DIRECTORY"],
    Airflow: ["AIRFLOW"],
    Android: ["ANDROID"],
    "BigQuery": ["BIGQUERY"],
    "CI/CD": ["CI_CD"],
    Dart: ["DART"],
    Docker: ["DOCKER"],
    Figma: ["FIGMA"],
    Firebase: ["FIREBASE"],
    Flutter: ["FLUTTER"],
    "GitHub Actions": ["GITHUB_ACTIONS", "CI_CD"],
    "Kubernetes": ["KUBERNETES"],
    Mantine: ["REACT", "TYPESCRIPT"],
    "Microsoft 365": ["M365"],
    M365: ["M365"],
    NestJS: ["NESTJS", "TYPESCRIPT"],
    PostgreSQL: ["POSTGRESQL", "SQL"],
    Prisma: ["PRISMA"],
    Prometheus: ["PROMETHEUS"],
    Python: ["PYTHON"],
    RabbitMQ: ["RABBITMQ"],
    React: ["REACT", "TYPESCRIPT"],
    Redis: ["REDIS"],
    SIEM: ["SIEM"],
    TypeScript: ["TYPESCRIPT"],
    VPN: ["VPN"],
    "Windows Server": ["WINDOWS_SERVER"]
  };
  return unique(technologies.flatMap((technology) => map[technology] ?? []));
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
