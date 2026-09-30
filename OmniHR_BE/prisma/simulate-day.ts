/**
 * Company-life simulator that keeps growing the dataset the AI features learn
 * from. Each run replays every workday since the previous run (up to yesterday,
 * company time) as if the company had lived it:
 *
 * - leave: people call in sick, file annual leave (in the app or by asking
 *   HRGenie), managers approve, reject, or accept a request to cancel;
 * - attendance: everyone not on leave checks in and out from the mobile app,
 *   with lateness, forgotten check-outs and the odd unexplained absence;
 * - work: department heads open projects and team tasks, leads split them
 *   into subtasks and assign them (usually after asking for AI suggestions),
 *   people start, hand in for review, get sent back for rework, and finish on
 *   time or late;
 * - HRGenie: a few people a day ask it about their leave, tasks and policies.
 *
 * Every one of those actions goes through the API's own services, as the
 * person doing it: the same permission checks, validation, audit log,
 * notifications and cache invalidation a click in the web or mobile app gets.
 * What stays with the simulator is only what a person decides - who is off
 * sick, who a lead picks, how fast someone works - driven by a stable hidden
 * persona per employee (ability, discipline), so the same people keep doing
 * well or badly. The clock the services read is moved to each simulated
 * moment (see simulation/clock.ts and simulation/timestamps.ts).
 *
 * The API refuses what it would refuse a real person; those refusals are
 * counted and printed, not worked around.
 *
 *   npm run prisma:simulate -- --from 2026-02-02      # first run: where history starts
 *   npm run prisma:simulate                          # catch up to yesterday
 *   npm run prisma:simulate -- --until 2026-10-02    # or up to a given date
 *
 * HRGenie's chats go to AI_SERVICE_URL, or SIMULATION_AI_SERVICE_URL when set
 * (point it at a rule-based instance to keep an LLM quota out of it).
 */
// First: the environment the API boots with.
import "./simulation/env";
import {
  AttendanceStatus,
  AttendanceRecordType,
  CareerLevel,
  EmployeeStatus,
  LeaveHalf,
  LeaveRequestStatus,
  ManagerType,
  Prisma,
  ProjectStatus,
  SkillProficiency,
  TaskPriority,
  TaskSkillImportance,
  TaskStatus
} from "@prisma/client";
import { ApiError } from "../src/common/api-error";
import type { AuthUser } from "../src/common/types";
import { SimulationApi, startSimulationApi } from "./simulation/api";
import { installClock, setNow, uninstallClock } from "./simulation/clock";
import {
  clampToToday,
  FALLBACK_OFFICE,
  internalProjectCode,
  isInternalProjectCode,
  officeFrom
} from "./simulation/rules";
import {
  Persona,
  buildPersona,
  clamp,
  createRandom,
  hash01,
  hashString
} from "./simulation-persona";

const TZ_OFFSET_MINUTES = 420;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const STATE_KEY = "simulation";
const MAX_DAYS_PER_RUN = 92;
/** How far a punch strays from the office point, in degrees (~30 m). */
const PUNCH_SPREAD = 0.0006;

const { TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED } = TaskStatus;
const OPEN_TASK_STATUSES = [TODO, IN_PROGRESS, IN_REVIEW];
/** Levels a lead may hand a stretch task to, and how often they do. */
const JUNIOR_LEVELS = new Set<CareerLevel>([CareerLevel.INTERN, CareerLevel.FRESHER, CareerLevel.JUNIOR]);
const MENTORING_CHANCE = 0.1;
const PRIORITY_RANK: Record<TaskPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
const PROFICIENCY_RANK: Record<SkillProficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4
};

// ---------------------------------------------------------------------------
// Work catalog
// ---------------------------------------------------------------------------

type SkillRequirement = readonly [code: string, proficiency: SkillProficiency, importance: TaskSkillImportance];
type JobTemplate = { title: string; hours: readonly [number, number]; skills: readonly SkillRequirement[] };
type TeamCatalog = {
  /** Subjects substituted for `{x}`; may themselves use `{month}` / `{quarter}`. */
  topics: readonly string[];
  technologies: readonly string[];
  /** Team-level task titles. */
  workstreams: readonly string[];
  /** Subtasks in the order a workstream normally runs them. */
  pipeline: readonly JobTemplate[];
  /** Small unplanned jobs, filed under the team's monthly support task. */
  quick: readonly JobTemplate[];
  /**
   * Small jobs a lead keeps for new people: beginner level in skills an
   * intern or fresher actually has. Without them every task asks for more
   * than a newcomer knows, the ranking rightly never proposes them, and the
   * newcomers never build the record that would let it.
   */
  starter?: readonly JobTemplate[];
  supportTitle: string;
};
type ProjectTemplate = {
  name: string;
  description: string;
  topics: readonly string[];
  /** `offset` is in workdays from the project start; `pick` selects pipeline steps. */
  workstreams: ReadonlyArray<{ team: string; offset: readonly [number, number]; pick?: readonly number[] }>;
};

const { BEGINNER: B, INTERMEDIATE: I, ADVANCED: A } = SkillProficiency;
const { REQUIRED: REQ, IMPORTANT: IMP, NICE_TO_HAVE: NICE } = TaskSkillImportance;

function job(title: string, hours: readonly [number, number], ...skills: SkillRequirement[]): JobTemplate {
  return { title, hours, skills };
}

const WEB_TOPICS = [
  "quản lý hợp đồng lao động",
  "đặt phòng họp",
  "khảo sát nội bộ",
  "quản lý tài sản cấp phát",
  "thưởng KPI theo quý",
  "lịch phỏng vấn ứng viên",
  "phê duyệt đề nghị thanh toán",
  "kho tài liệu nội bộ",
  "đánh giá 360 độ",
  "đăng ký làm thêm giờ",
  "quản lý công tác phí",
  "đào tạo nội bộ"
];
const MOBILE_TOPICS = [
  "chấm công bằng nhận diện khuôn mặt",
  "bảng lương cá nhân",
  "đăng ký ca làm việc",
  "đặt phòng họp",
  "thông báo nội bộ",
  "đánh giá 360 độ",
  "đăng ký làm thêm giờ",
  "danh bạ công ty"
];
const AI_TOPICS = [
  "chatbot HRGenie tra cứu chính sách",
  "gợi ý người nhận task",
  "dự báo nguy cơ nghỉ việc",
  "tóm tắt phiếu đánh giá hiệu suất",
  "sàng lọc CV ứng viên",
  "phát hiện bất thường chấm công",
  "dự báo khối lượng công việc theo nhóm"
];
const INFRA_TOPICS = [
  "cụm staging",
  "cơ sở dữ liệu production",
  "hệ thống log tập trung",
  "máy chủ build",
  "dịch vụ OmniHR AI",
  "hệ thống sao lưu"
];
const SALES_PIPELINE = [
  job("Nghiên cứu thị trường {x}", [4, 8], ["MARKET_RESEARCH", I, REQ]),
  job("Lập danh sách và tiếp cận {x}", [6, 12], ["B2B_SALES", I, REQ], ["CRM", I, IMP]),
  job("Demo giải pháp OmniHR cho {x}", [4, 8], ["PRESENTATION", A, REQ], ["PRESALES_SOLUTION", I, NICE]),
  job("Gửi báo giá và đàm phán với {x}", [4, 8], ["NEGOTIATION", A, REQ], ["ACCOUNT_MANAGEMENT", I, IMP]),
  job("Cập nhật pipeline CRM cho {x}", [2, 4], ["CRM", I, REQ])
];
const SALES_QUICK = [
  job("Chăm sóc khách hàng phản hồi chậm thuộc nhóm {x}", [1, 3], ["ACCOUNT_MANAGEMENT", I, REQ], ["CUSTOMER_SERVICE", I, IMP]),
  job("Chuẩn bị hồ sơ năng lực gửi {x}", [2, 4], ["PRESENTATION", I, REQ])
];

const CATALOGS: Record<string, TeamCatalog> = {
  "IT-BE": {
    topics: WEB_TOPICS,
    technologies: ["NestJS", "Prisma", "PostgreSQL", "Redis"],
    workstreams: ["Backend: {x}", "API và dữ liệu cho {x}"],
    pipeline: [
      job("Thiết kế schema dữ liệu cho {x}", [8, 16], ["POSTGRESQL", A, REQ], ["PRISMA", I, IMP], ["SYSTEM_DESIGN", I, NICE]),
      job("Xây dựng API CRUD cho {x}", [12, 24], ["NESTJS", A, REQ], ["TYPESCRIPT", I, REQ], ["REST_API", I, IMP]),
      job("Phân quyền và kiểm tra nghiệp vụ {x}", [8, 14], ["NESTJS", I, REQ], ["SYSTEM_DESIGN", I, IMP]),
      job("Cache và tối ưu truy vấn {x}", [6, 12], ["REDIS", I, REQ], ["POSTGRESQL", A, IMP]),
      job("Viết unit test và e2e cho {x}", [8, 16], ["TESTING", I, REQ], ["TYPESCRIPT", I, IMP]),
      job("Review mã nguồn và hoàn thiện tài liệu API {x}", [4, 8], ["CODE_REVIEW", A, REQ], ["REST_API", I, NICE])
    ],
    starter: [
      job("Viết thêm test cho API {x} theo mẫu có sẵn", [2, 4], ["NODEJS", B, REQ], ["TYPESCRIPT", B, NICE]),
      job("Bổ sung mô tả Swagger cho các API {x}", [2, 3], ["REST_API", B, REQ])
    ],
    quick: [
      job("Sửa lỗi 500 khi xuất báo cáo {x}", [2, 6], ["NESTJS", I, REQ], ["POSTGRESQL", I, IMP]),
      job("Bổ sung bộ lọc cho API {x}", [3, 6], ["NESTJS", I, REQ], ["PRISMA", I, IMP]),
      job("Điều tra truy vấn chậm ở {x}", [3, 8], ["POSTGRESQL", A, REQ]),
      job("Nâng cấp thư viện có lỗ hổng bảo mật", [2, 5], ["NODEJS", I, REQ], ["GIT", B, NICE])
    ],
    supportTitle: "Vận hành & sửa lỗi Backend"
  },
  "IT-WEB": {
    topics: WEB_TOPICS,
    technologies: ["React", "TypeScript", "Mantine", "TanStack Query"],
    workstreams: ["Web: {x}", "Web - màn hình quản trị {x}"],
    pipeline: [
      job("Dựng màn danh sách và bộ lọc {x}", [10, 18], ["REACT", A, REQ], ["TYPESCRIPT", I, IMP]),
      job("Form tạo/sửa {x} kèm validate", [8, 16], ["REACT", I, REQ], ["TYPESCRIPT", I, REQ]),
      job("Tích hợp API {x} và xử lý trạng thái tải", [6, 12], ["JAVASCRIPT", I, REQ], ["REACT", I, IMP]),
      job("Responsive và hoàn thiện UI {x} theo thiết kế", [6, 10], ["CSS", I, REQ], ["HTML", I, IMP], ["TAILWIND", B, NICE]),
      job("Viết test component cho {x}", [6, 10], ["TESTING", I, REQ], ["REACT", I, IMP])
    ],
    starter: [
      job("Sửa nội dung và nhãn hiển thị trên màn {x}", [2, 4], ["HTML", B, REQ]),
      job("Bổ sung kiểm tra dữ liệu nhập đơn giản cho form {x}", [2, 4], ["JAVASCRIPT", B, REQ], ["HTML", B, NICE])
    ],
    quick: [
      job("Sửa lỗi vỡ bố cục bảng {x} trên màn hình nhỏ", [2, 5], ["CSS", I, REQ]),
      job("Bổ sung bản dịch i18n cho màn {x}", [2, 4], ["REACT", B, REQ]),
      job("Sửa lỗi phân trang không giữ bộ lọc ở {x}", [3, 6], ["REACT", I, REQ], ["TYPESCRIPT", I, IMP])
    ],
    supportTitle: "Vận hành & sửa lỗi Web"
  },
  "IT-MOBILE": {
    topics: MOBILE_TOPICS,
    technologies: ["Flutter", "Dart", "Firebase", "Swift", "Kotlin"],
    workstreams: ["Mobile: {x}", "Mobile - tính năng {x}"],
    pipeline: [
      job("Màn hình {x} trên ứng dụng nhân viên", [12, 20], ["FLUTTER", A, REQ], ["DART", I, REQ]),
      job("Tích hợp native iOS cho {x}", [6, 12], ["SWIFT", I, REQ], ["IOS", I, IMP]),
      job("Tích hợp native Android cho {x}", [6, 12], ["KOTLIN", I, REQ], ["ANDROID", I, IMP]),
      job("Gọi API và lưu tạm offline dữ liệu {x}", [8, 14], ["FLUTTER", I, REQ], ["REST_API", I, IMP]),
      job("Push notification cho {x}", [6, 10], ["FIREBASE", I, REQ], ["FLUTTER", I, IMP]),
      job("Viết widget test cho {x}", [6, 10], ["TESTING", I, REQ], ["DART", I, IMP]),
      job("Build và phát hành bản thử nghiệm có {x}", [4, 8], ["MOBILE_CI_CD", I, REQ], ["ANDROID", B, NICE])
    ],
    starter: [
      job("Chỉnh khoảng cách và màu theo thiết kế ở màn {x}", [2, 4], ["FLUTTER", B, REQ]),
      job("Viết model và parse JSON cho {x}", [2, 4], ["DART", B, REQ], ["FLUTTER", B, NICE])
    ],
    quick: [
      job("Sửa lỗi crash Android khi mở {x}", [3, 6], ["ANDROID", I, REQ], ["FLUTTER", I, IMP]),
      job("Tối ưu thời gian tải màn {x}", [4, 8], ["FLUTTER", A, REQ]),
      job("Sửa lỗi hiển thị font tiếng Việt trên iOS", [2, 4], ["FLUTTER", I, REQ])
    ],
    supportTitle: "Vận hành & sửa lỗi Mobile"
  },
  "IT-QA": {
    topics: WEB_TOPICS,
    technologies: ["Playwright", "Postman", "k6"],
    workstreams: ["QA: {x}", "QA - kiểm thử {x}"],
    pipeline: [
      job("Viết test case cho {x}", [6, 12], ["MANUAL_TESTING", I, REQ], ["TESTING", I, IMP]),
      job("Kiểm thử API {x}", [6, 12], ["API_TESTING", I, REQ], ["SQL", B, NICE]),
      job("Tự động hóa kiểm thử {x} bằng Playwright", [10, 18], ["PLAYWRIGHT", I, REQ], ["AUTOMATION_TESTING", I, REQ]),
      job("Kiểm thử hiệu năng {x}", [6, 10], ["PERFORMANCE_TESTING", I, REQ]),
      job("Kiểm thử hồi quy trước khi phát hành {x}", [6, 12], ["MANUAL_TESTING", I, REQ], ["AUTOMATION_TESTING", B, NICE])
    ],
    starter: [
      job("Chạy lại bộ test thủ công cho {x} và ghi kết quả", [2, 4], ["MANUAL_TESTING", B, REQ])
    ],
    quick: [
      job("Tái hiện và xác minh lỗi khách hàng báo ở {x}", [2, 4], ["MANUAL_TESTING", I, REQ]),
      job("Sửa bộ test tự động lỗi sau khi đổi giao diện {x}", [3, 6], ["PLAYWRIGHT", I, REQ])
    ],
    supportTitle: "Kiểm thử phát sinh"
  },
  "IT-DEVOPS": {
    topics: INFRA_TOPICS,
    technologies: ["Terraform", "Kubernetes", "Docker", "Prometheus", "Grafana"],
    workstreams: ["DevOps: {x}", "DevOps - vận hành {x}"],
    pipeline: [
      job("Viết Terraform khởi tạo {x}", [10, 16], ["TERRAFORM", A, REQ], ["AWS", I, IMP]),
      job("Container hóa và triển khai {x} lên Kubernetes", [10, 18], ["KUBERNETES", A, REQ], ["DOCKER", I, REQ]),
      job("Thiết lập pipeline CI/CD cho {x}", [6, 12], ["CI_CD", I, REQ], ["GITHUB_ACTIONS", I, IMP]),
      job("Giám sát và cảnh báo {x} với Prometheus/Grafana", [6, 12], ["PROMETHEUS", I, REQ], ["GRAFANA", I, IMP]),
      job("Hardening bảo mật Linux cho {x}", [4, 8], ["LINUX", A, REQ])
    ],
    quick: [
      job("Gia hạn chứng chỉ SSL cho {x}", [1, 3], ["LINUX", I, REQ]),
      job("Xử lý cảnh báo đầy ổ đĩa trên {x}", [2, 5], ["LINUX", I, REQ], ["MONITORING", I, IMP]),
      job("Khôi phục thử bản sao lưu {x}", [3, 6], ["LINUX", I, REQ], ["DOCKER", B, NICE])
    ],
    supportTitle: "Vận hành hạ tầng DevOps"
  },
  "IT-PRODUCT": {
    topics: WEB_TOPICS,
    technologies: ["Figma", "Confluence", "Jira"],
    workstreams: ["Sản phẩm & thiết kế: {x}", "Đặc tả sản phẩm {x}"],
    pipeline: [
      job("Phỏng vấn người dùng về nhu cầu {x}", [6, 12], ["PRODUCT_DISCOVERY", I, REQ], ["STAKEHOLDER_MANAGEMENT", I, IMP]),
      job("Viết user story và tiêu chí nghiệm thu cho {x}", [6, 12], ["USER_STORY", A, REQ], ["REQUIREMENT_ANALYSIS", I, IMP]),
      job("Vẽ quy trình nghiệp vụ BPMN cho {x}", [4, 8], ["BPMN", I, REQ], ["DOCUMENTATION", I, NICE]),
      job("Thiết kế wireframe {x} trên Figma", [8, 14], ["FIGMA", I, REQ], ["UI_UX", I, IMP]),
      job("Thiết kế UI chi tiết và prototype {x}", [10, 16], ["UI_UX", A, REQ], ["FIGMA", A, REQ])
    ],
    quick: [
      job("Cập nhật roadmap sau buổi demo {x}", [2, 4], ["ROADMAP", I, REQ]),
      job("Chuẩn bị tài liệu demo {x} cho ban giám đốc", [3, 6], ["DOCUMENTATION", I, REQ], ["STAKEHOLDER_MANAGEMENT", I, IMP])
    ],
    supportTitle: "Hỗ trợ sản phẩm"
  },
  "IT-AI": {
    topics: AI_TOPICS,
    technologies: ["Python", "FastAPI", "LLM", "RAG"],
    workstreams: ["AI: {x}", "AI - mô hình {x}"],
    pipeline: [
      job("Thu thập và làm sạch dữ liệu cho {x}", [8, 16], ["DATA_ENGINEERING", I, REQ], ["SQL", I, IMP]),
      job("Xây dựng mô hình/pipeline cho {x}", [16, 28], ["MACHINE_LEARNING", A, REQ], ["PYTHON", A, REQ], ["LLM", I, IMP]),
      job("Đánh giá độ chính xác của {x}", [6, 12], ["MACHINE_LEARNING", I, REQ], ["PYTHON", I, IMP]),
      job("Đóng gói API FastAPI cho {x}", [6, 12], ["FASTAPI", I, REQ], ["DOCKER", B, NICE]),
      job("Theo dõi chất lượng và chi phí vận hành {x}", [4, 8], ["LLM", I, REQ], ["DATA_ENGINEERING", B, NICE])
    ],
    starter: [
      job("Làm sạch và gắn nhãn dữ liệu mẫu cho {x}", [2, 4], ["PYTHON", B, REQ])
    ],
    quick: [
      job("Cập nhật tài liệu tri thức cho {x}", [2, 4], ["RAG", I, REQ]),
      job("Điều tra câu trả lời sai của {x}", [2, 6], ["LLM", I, REQ], ["PYTHON", I, IMP]),
      job("Chạy lại pipeline dữ liệu lỗi của {x}", [1, 3], ["DATA_ENGINEERING", I, REQ])
    ],
    supportTitle: "Vận hành & sửa lỗi AI"
  },
  "HR-TA": {
    topics: [
      "Backend Developer",
      "Kế toán tổng hợp",
      "Sales Executive",
      "QA Engineer",
      "Chuyên viên C&B",
      "thực tập sinh CNTT",
      "Flutter Developer",
      "Nhân viên hành chính"
    ],
    technologies: ["TopCV", "LinkedIn", "HRIS"],
    workstreams: ["Tuyển dụng vị trí {x}", "Tuyển dụng và hội nhập {x}"],
    pipeline: [
      job("Viết JD và đăng tin tuyển {x}", [3, 6], ["RECRUITMENT", I, REQ], ["EMPLOYER_BRANDING", B, NICE]),
      job("Sàng lọc hồ sơ ứng viên {x}", [8, 16], ["RECRUITMENT", I, REQ], ["HRIS", B, IMP]),
      job("Phỏng vấn vòng 1 ứng viên {x}", [8, 16], ["INTERVIEWING", A, REQ]),
      job("Gửi offer và thương lượng với ứng viên {x}", [3, 6], ["RECRUITMENT", I, REQ], ["PRESENTATION", B, NICE]),
      job("Tổ chức hội nhập cho {x} mới", [4, 8], ["TRAINING_DESIGN", I, REQ], ["PRESENTATION", I, IMP])
    ],
    quick: [
      job("Liên hệ tham chiếu ứng viên {x}", [1, 3], ["RECRUITMENT", B, REQ]),
      job("Cập nhật báo cáo phễu tuyển dụng {x}", [2, 4], ["EXCEL", I, REQ])
    ],
    supportTitle: "Công việc tuyển dụng phát sinh"
  },
  "HR-CB": {
    topics: ["khối Công nghệ", "khối Kinh doanh", "khối Văn phòng", "nhân sự mới {quarter}", "toàn công ty {month}"],
    technologies: ["HRIS", "Excel", "VssID"],
    workstreams: ["C&B {x}", "Chế độ và phúc lợi {x}"],
    pipeline: [
      job("Tổng hợp bảng công {x}", [4, 8], ["HRIS", I, REQ], ["EXCEL", I, IMP]),
      job("Tính lương và phụ cấp {x}", [6, 12], ["PAYROLL_CB", A, REQ], ["EXCEL", I, IMP]),
      job("Rà soát hồ sơ BHXH {x}", [4, 8], ["SOCIAL_INSURANCE", I, REQ], ["LABOR_LAW", I, IMP]),
      job("Cập nhật hợp đồng lao động {x}", [4, 8], ["LABOR_LAW", I, REQ]),
      job("Báo cáo chi phí nhân sự {x}", [4, 6], ["EXCEL", A, REQ])
    ],
    quick: [
      job("Giải đáp thắc mắc phiếu lương {x}", [1, 3], ["PAYROLL_CB", I, REQ]),
      job("Làm thủ tục báo tăng/giảm BHXH {x}", [2, 4], ["SOCIAL_INSURANCE", I, REQ])
    ],
    supportTitle: "Yêu cầu C&B phát sinh"
  },
  "FIN-GL": {
    topics: ["{month}", "{quarter}", "chi nhánh Hồ Chí Minh {month}", "nhóm nhà cung cấp thiết bị {month}"],
    technologies: ["MISA", "Excel", "Hóa đơn điện tử"],
    workstreams: ["Kế toán {x}", "Khóa sổ {x}"],
    pipeline: [
      job("Kiểm tra chứng từ và hóa đơn {x}", [4, 8], ["ACCOUNTING_VAS", I, REQ]),
      job("Hạch toán chi phí {x} trên MISA", [6, 10], ["MISA", I, REQ], ["ACCOUNTING_VAS", I, IMP]),
      job("Đối chiếu công nợ {x}", [6, 12], ["ACCOUNTING_VAS", A, REQ], ["EXCEL", I, IMP]),
      job("Kê khai thuế GTGT {x}", [4, 8], ["TAX", A, REQ]),
      job("Lập báo cáo tài chính {x}", [8, 14], ["FINANCIAL_REPORTING", A, REQ], ["EXCEL", I, IMP])
    ],
    quick: [
      job("Xử lý đề nghị thanh toán gấp {x}", [1, 3], ["ACCOUNTING_VAS", I, REQ]),
      job("Điều chỉnh hóa đơn sai thông tin {x}", [2, 4], ["TAX", I, REQ], ["MISA", I, IMP])
    ],
    supportTitle: "Nghiệp vụ kế toán phát sinh"
  },
  "SAL-HN": {
    topics: [
      "khách hàng FDI tại Bắc Ninh",
      "chuỗi bán lẻ tại Hà Nội",
      "trường đại học tư thục",
      "khách hàng tái ký năm sau",
      "doanh nghiệp logistics miền Bắc"
    ],
    technologies: ["CRM", "OmniHR Demo"],
    workstreams: ["Khu vực Hà Nội: {x}", "Phát triển {x} tại miền Bắc"],
    pipeline: SALES_PIPELINE,
    quick: SALES_QUICK,
    supportTitle: "Chăm sóc khách hàng miền Bắc"
  },
  "SAL-HCM": {
    topics: [
      "khu công nghiệp Bình Dương",
      "chuỗi nhà hàng tại TP.HCM",
      "doanh nghiệp may mặc",
      "khách hàng SME quận 7",
      "công ty logistics Cát Lái"
    ],
    technologies: ["CRM", "OmniHR Demo"],
    workstreams: ["Khu vực TP.HCM: {x}", "Phát triển {x} tại miền Nam"],
    pipeline: SALES_PIPELINE,
    quick: SALES_QUICK,
    supportTitle: "Chăm sóc khách hàng miền Nam"
  },
  "OPS-SUP": {
    topics: [
      "cải tạo văn phòng tầng 12",
      "mở rộng chi nhánh Hồ Chí Minh",
      "sắp xếp lại kho thiết bị IT",
      "tổ chức team building cuối năm",
      "gia hạn hợp đồng dịch vụ tòa nhà",
      "tổ chức tiệc tất niên"
    ],
    technologies: ["Microsoft 365", "Excel"],
    workstreams: ["Hành chính: {x}", "Hậu cần {x}"],
    pipeline: [
      job("Khảo sát nhu cầu cho {x}", [3, 6], ["OFFICE_ADMIN", I, REQ]),
      job("Lấy báo giá nhà cung cấp cho {x}", [4, 8], ["PROCUREMENT", I, REQ], ["NEGOTIATION", B, NICE]),
      job("Đàm phán và ký hợp đồng cho {x}", [4, 8], ["VENDOR_MANAGEMENT", I, REQ], ["NEGOTIATION", I, IMP]),
      job("Theo dõi ngân sách {x}", [3, 6], ["COST_CONTROL", I, REQ], ["EXCEL", I, IMP]),
      job("Kiểm kê tài sản phục vụ {x}", [4, 8], ["ASSET_MANAGEMENT", I, REQ])
    ],
    quick: [
      job("Xử lý yêu cầu hỗ trợ Microsoft 365 cho nhân viên mới", [1, 3], ["M365", I, REQ], ["HELPDESK", I, IMP]),
      job("Đặt văn phòng phẩm và nước uống {month}", [1, 2], ["OFFICE_ADMIN", B, REQ]),
      job("Sửa chữa thiết bị hỏng tại văn phòng", [2, 4], ["ASSET_MANAGEMENT", I, REQ], ["VENDOR_MANAGEMENT", B, NICE])
    ],
    supportTitle: "Hỗ trợ hành chính"
  }
};

const PROJECT_TEMPLATES: Record<string, readonly ProjectTemplate[]> = {
  IT: [
    {
      name: "[Web] Phân hệ {x} trên cổng quản trị",
      description:
        "Nhóm Web chủ trì phát triển phân hệ {x} trên cổng quản trị OmniHR, cùng Backend làm API và QA kiểm thử trước khi phát hành.",
      topics: WEB_TOPICS,
      workstreams: [
        { team: "IT-WEB", offset: [4, 8] },
        { team: "IT-PRODUCT", offset: [0, 0], pick: [0, 1, 3] },
        { team: "IT-BE", offset: [2, 5] },
        { team: "IT-QA", offset: [10, 14], pick: [0, 2, 4] }
      ]
    },
    {
      name: "[Mobile] Tính năng {x} trên ứng dụng nhân viên",
      description:
        "Nhóm Mobile chủ trì đưa tính năng {x} lên ứng dụng iOS/Android cho nhân viên, dùng chung API với bản web.",
      topics: MOBILE_TOPICS,
      workstreams: [
        { team: "IT-MOBILE", offset: [4, 8] },
        { team: "IT-PRODUCT", offset: [0, 0], pick: [1, 3, 4] },
        { team: "IT-BE", offset: [2, 5], pick: [1, 2, 4] },
        { team: "IT-QA", offset: [10, 14], pick: [0, 4] }
      ]
    },
    {
      name: "[AI] Xây dựng {x}",
      description: "Nhóm Dữ liệu & AI chủ trì xây dựng {x}; Backend tích hợp vào hệ thống và QA kiểm thử đầu cuối.",
      topics: AI_TOPICS,
      workstreams: [
        { team: "IT-AI", offset: [0, 2] },
        { team: "IT-BE", offset: [6, 10], pick: [2, 4] },
        { team: "IT-QA", offset: [12, 16], pick: [1] }
      ]
    },
    {
      name: "[DevOps] Nâng cấp {x}",
      description: "Nhóm DevOps chủ trì chuẩn hóa {x}: hạ tầng dưới dạng mã, triển khai tự động, giám sát và kiểm thử tải.",
      topics: INFRA_TOPICS,
      workstreams: [
        { team: "IT-DEVOPS", offset: [0, 2] },
        { team: "IT-QA", offset: [8, 12], pick: [3, 4] }
      ]
    },
    {
      name: "[Backend] Nền tảng API cho {x}",
      description: "Nhóm Backend chủ trì dựng nền tảng API và dữ liệu cho {x}, dùng chung cho web và mobile.",
      topics: WEB_TOPICS,
      workstreams: [
        { team: "IT-BE", offset: [0, 2] },
        { team: "IT-QA", offset: [8, 12], pick: [1, 3] }
      ]
    }
  ],
  HR: [
    {
      name: "Chiến dịch tuyển dụng {x}",
      description: "Tuyển đủ nhân sự vị trí {x}: đăng tin, sàng lọc, phỏng vấn, gửi offer và hội nhập.",
      topics: CATALOGS["HR-TA"].topics,
      workstreams: [{ team: "HR-TA", offset: [0, 1], pick: [0, 1, 2, 3, 4] }]
    },
    {
      name: "Rà soát chế độ lương thưởng {x}",
      description: "Rà soát bảng công, lương, BHXH và hợp đồng lao động cho {x}.",
      topics: CATALOGS["HR-CB"].topics,
      workstreams: [{ team: "HR-CB", offset: [0, 2], pick: [0, 1, 2, 3, 4] }]
    }
  ],
  FIN: [
    {
      name: "Khóa sổ và báo cáo tài chính {x}",
      description: "Hoàn tất chứng từ, hạch toán, đối chiếu công nợ, kê khai thuế và lập báo cáo tài chính {x}.",
      topics: ["{month}", "{quarter}", "chi nhánh Hồ Chí Minh {quarter}"],
      workstreams: [{ team: "FIN-GL", offset: [0, 1], pick: [0, 1, 2, 3, 4] }]
    }
  ],
  SALES: [
    {
      name: "Chiến dịch kinh doanh {x}",
      description: "Tìm kiếm và chốt hợp đồng OmniHR với {x} ở cả hai miền.",
      topics: [
        "khách hàng ngành giáo dục",
        "khách hàng ngành bán lẻ",
        "khách hàng ngành sản xuất",
        "khách hàng ngành logistics",
        "doanh nghiệp SME"
      ],
      workstreams: [
        { team: "SAL-HN", offset: [0, 2] },
        { team: "SAL-HCM", offset: [0, 3] }
      ]
    }
  ],
  OPS: [
    {
      name: "Dự án {x}",
      description: "Khảo sát, mua sắm, ký hợp đồng và theo dõi ngân sách cho hạng mục {x}.",
      topics: CATALOGS["OPS-SUP"].topics,
      workstreams: [{ team: "OPS-SUP", offset: [0, 2], pick: [0, 1, 2, 3, 4] }]
    }
  ]
};

const SICK_REASONS = [
  "Sốt cao, xin nghỉ để đi khám.",
  "Bị viêm họng và sốt, bác sĩ yêu cầu nghỉ ngơi.",
  "Đau dạ dày cấp, xin nghỉ để điều trị.",
  "Ngộ độc thực phẩm nhẹ, cần nghỉ ngơi.",
  "Đau lưng cấp, đi khám và vật lý trị liệu."
];
const ANNUAL_REASONS = [
  "Về quê có việc gia đình.",
  "Đi du lịch cùng gia đình.",
  "Tham dự đám cưới người thân.",
  "Đưa con đi khám sức khỏe định kỳ.",
  "Giải quyết thủ tục hành chính cá nhân.",
  "Nghỉ ngơi sau đợt cao điểm dự án.",
  "Chuyển nhà."
];
const UNPAID_REASONS = ["Chăm sóc người thân nằm viện.", "Việc cá nhân đột xuất, đã hết phép năm."];
const CANCEL_REASONS = [
  "Dự án cần gấp, em xin đi làm lại.",
  "Kế hoạch gia đình thay đổi, không cần nghỉ nữa.",
  "Em đổi lịch nghỉ sang dịp khác."
];
const CANCEL_KEEP_REASONS = [
  "Đã sắp xếp người thay, em cứ nghỉ theo kế hoạch.",
  "Lịch nghỉ đã báo khách hàng, giữ nguyên giúp anh/chị nhé."
];
const REJECTION_REASONS = [
  "Trùng thời điểm bàn giao dự án, đề nghị dời sang tuần sau.",
  "Nhóm đã có hai người nghỉ cùng thời gian này.",
  "Đơn gửi quá sát ngày nghỉ, cần sắp xếp người thay thế trước.",
  "Đang trong giai đoạn chốt số liệu cuối kỳ, chưa thể duyệt."
];
const ASSIGN_NOTES = [
  "Phân công theo kế hoạch sprint",
  "Giao theo kỹ năng phù hợp",
  "Phân công trong buổi họp nhóm đầu tuần",
  "Nhờ hỗ trợ vì đang ít việc"
];
const APPROVE_NOTES = [
  "Đạt yêu cầu, cảm ơn em.",
  "Đã review, ổn.",
  "OK, merge được rồi.",
  "Đạt, lưu ý cập nhật tài liệu kèm theo."
];
const REWORK_NOTES = [
  "Còn thiếu một số trường hợp biên, em bổ sung giúp anh/chị.",
  "Chưa đạt tiêu chí nghiệm thu, xem lại phần xử lý lỗi.",
  "Cần viết thêm test trước khi duyệt.",
  "Kết quả chưa khớp yêu cầu, em đối chiếu lại đặc tả nhé."
];
const SUBMIT_NOTES = ["Em đã làm xong, nhờ anh/chị review.", "Đã hoàn thành, mời review.", undefined];
const DROP_NOTES = ["Yêu cầu thay đổi, không cần làm nữa.", "Khách hàng hủy hạng mục này."];

/** What people ask HRGenie about their own day. */
const EMPLOYEE_QUESTIONS = [
  "Tôi còn bao nhiêu ngày phép?",
  "Hôm nay tôi đã chấm công chưa?",
  "Tuần này tôi có task nào đến hạn không?",
  "Các task tôi đang làm là gì?",
  "Đơn nghỉ phép của tôi đã được duyệt chưa?",
  "Quản lý trực tiếp của tôi là ai?",
  "Giờ làm việc của công ty thế nào?",
  "Đi muộn thì bị xử lý thế nào?",
  "Công ty có những chế độ phúc lợi gì?",
  "Mã nhân viên của tôi là gì?",
  "Hôm nay ai nghỉ phép?",
  "Nghỉ ốm cần giấy tờ gì không?"
];
/** What leads and heads ask on top of that. */
const MANAGER_QUESTIONS = [
  "Sáng nay team mình ai đi muộn?",
  "Nhóm tôi còn bao nhiêu việc chưa xong?",
  "Tuần sau có ai trong team xin nghỉ không?",
  "Phòng mình hiện có bao nhiêu nhân sự?",
  "Hôm nay ai vắng mặt?"
];

// ---------------------------------------------------------------------------
// Simulation context and state
// ---------------------------------------------------------------------------

type SimEmployee = {
  id: number;
  code: string;
  fullName: string;
  userId: number | null;
  level: CareerLevel;
  hireDate: Date | null;
  departmentId: number | null;
  isHead: boolean;
  isLead: boolean;
  managerUserId: number | null;
  skills: Map<number, SkillProficiency>;
  persona: Persona;
};

type SimTeam = { id: number; code: string; name: string; departmentId: number; leadId: number | null; memberIds: number[] };
type SimDepartment = { id: number; code: string; headId: number | null };

type Context = {
  employees: Map<number, SimEmployee>;
  teams: SimTeam[];
  departments: Map<number, SimDepartment>;
  skillIds: Map<string, number>;
  leaveTypes: Map<string, { id: number; annualAllowance: number | null }>;
  adminUserId: number;
  /** The company location punches are taken around. */
  office: { latitude: number; longitude: number };
};

type SimulationState = {
  lastDate: string;
  sequence: number;
  /** Extra hours a task still needs after failing review, by task id. */
  rework: Record<string, number>;
  /**
   * Hours put into each open task so far. Only the lead can write actual
   * hours in the API, and does so when accepting the work, so until then the
   * running total lives here, the way it lives in the assignee's head.
   */
  logged: Record<string, number>;
  /** Product projects still taking new work, by project id. */
  projects: Record<string, ProjectPlan>;
  /** The day each department last opened a product project, by department id. */
  lastProjectOn: Record<string, string>;
};

/**
 * A product project as its department head planned it: which teams work on
 * it, and until when it takes new work. Past that date the teams finish what
 * is open and the project closes - two to three months in all.
 */
type ProjectPlan = {
  code: string;
  topic: string;
  departmentId: number;
  /** The team that asked for it first; the others join as they free up. */
  teamIds: number[];
  start: string;
  /** Last day new work is added. */
  freeze: string;
  /** Sprints (rounds, outside IT) planned so far, by team id. */
  phases: Record<string, number>;
  /** Each team's name for its part of the project, by team id: "Web: đặt phòng họp". */
  titles?: Record<string, string>;
};

type Totals = {
  days: string[];
  attendanceRecords: number;
  lateCheckIns: number;
  absences: number;
  sickLeaves: number;
  leaveFiled: number;
  leaveApproved: number;
  leaveRejected: number;
  leaveCancelled: number;
  halfDayLeaves: number;
  cancelRequested: number;
  cancelApproved: number;
  cancelRejected: number;
  projects: string[];
  projectsStarted: string[];
  projectsCompleted: string[];
  newTasks: number;
  assignments: number;
  reassignments: number;
  aiSuggestions: number;
  aiPicked: number;
  started: number;
  submitted: number;
  completed: number;
  completedLate: number;
  reworks: number;
  cancelled: number;
  chats: number;
  chatLeaves: number;
  notificationsRead: number;
  /** What the API refused, by error code. */
  refused: Record<string, number>;
};

/** One person's day at the office, decided in the morning. */
type Presence = {
  employee: SimEmployee;
  checkIn: number;
  checkOut: number | null;
  hours: number;
};

/**
 * Public holidays from the holidays table (seeded by its migration), loaded
 * once in main(): nobody works, files leave or is absent on them.
 */
let holidays: ReadonlySet<number> = new Set();
let api: SimulationApi;
/** The workday being replayed; every request of the day happens on it. */
let currentDay: Date;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The simulator writes synthetic data and refuses to run with NODE_ENV=production.");
  }
  const options = parseArgs(process.argv.slice(2));
  installClock();
  api = await startSimulationApi();
  try {
    await run(options);
  } finally {
    setNow(null);
    await api.close();
    uninstallClock();
  }
}

async function run(options: ReturnType<typeof parseArgs>) {
  holidays = new Set(
    (await api.prisma.holiday.findMany({ select: { date: true } })).map((row) => row.date.getTime())
  );
  const today = companyToday(new Date());
  const until = options.until ?? addDays(today, -1);
  const state = await loadState(options.from);
  const context = await loadContext();
  const totals = createTotals();
  await ensureCompanyLocation(context, addDays(dateOnly(state.lastDate), 1));

  let processed = 0;
  for (let day = addDays(dateOnly(state.lastDate), 1); day <= until; day = addDays(day, 1)) {
    if (processed >= options.maxDays) {
      console.warn(`Dừng sau ${options.maxDays} ngày; chạy lại để mô phỏng tiếp.`);
      break;
    }
    processed += 1;

    if (isWorkday(day)) {
      currentDay = day;
      await simulateDay(context, state, day, totals);
      totals.days.push(iso(day));
      console.info(`✓ ${iso(day)}`);
    }
    state.lastDate = iso(day);
    await saveState(state);
  }

  setNow(null);
  printSummary(totals, state);
  await printPerformers(context, dateOnly(state.lastDate));
}

function parseArgs(args: string[], today = companyToday(new Date())) {
  let until: Date | null = null;
  let from: Date | null = null;
  let maxDays = MAX_DAYS_PER_RUN;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--until" || arg === "--from") {
      const requested = dateOnly(args[++index] ?? "");
      if (Number.isNaN(requested.getTime())) {
        throw new Error(`${arg} expects a date in YYYY-MM-DD format`);
      }
      if (arg === "--from") {
        from = requested;
        continue;
      }
      until = clampToToday(requested, today);
      if (until < requested) {
        console.warn(
          `--until ${iso(requested)} nằm ở tương lai; đã giới hạn lại ở hôm nay (${iso(until)}).`
        );
      }
    } else if (arg === "--max-days") {
      maxDays = Number(args[++index]);
      if (!Number.isInteger(maxDays) || maxDays < 1) {
        throw new Error("--max-days expects a positive integer");
      }
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }
  return { until, from, maxDays };
}

async function loadState(from: Date | null): Promise<SimulationState> {
  const record = await api.prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  if (record) {
    if (from) {
      throw new Error(`--from chỉ dùng cho lần chạy đầu; dữ liệu đã mô phỏng tới ${(record.value as { lastDate?: string }).lastDate}.`);
    }
    const value = record.value as Partial<SimulationState>;
    return {
      lastDate: value.lastDate ?? iso(addDays(companyToday(new Date()), -1)),
      sequence: value.sequence ?? 0,
      rework: value.rework ?? {},
      logged: value.logged ?? {},
      projects: value.projects ?? {},
      lastProjectOn: value.lastProjectOn ?? {}
    };
  }
  if (from) {
    return { lastDate: iso(addDays(from, -1)), sequence: 0, rework: {}, logged: {}, projects: {}, lastProjectOn: {} };
  }
  // A database seeded with its anchor month: continue right after it.
  const latestAttendance = await api.prisma.attendanceRecord.aggregate({ _max: { workDate: true } });
  if (!latestAttendance._max.workDate) {
    throw new Error("Chưa có lịch sử nào: chạy lần đầu với --from YYYY-MM-DD để chọn ngày bắt đầu.");
  }
  return {
    lastDate: iso(latestAttendance._max.workDate),
    sequence: 0,
    rework: {},
    logged: {},
    projects: {},
    lastProjectOn: {}
  };
}

/** Simulator bookkeeping, not company data, so it is written directly. */
async function saveState(state: SimulationState) {
  const value = state as unknown as Prisma.InputJsonValue;
  await api.prisma.systemSetting.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, value },
    update: { value }
  });
}

/**
 * Attendance needs a company point to check the radius against. An admin
 * sets it once, from the web settings page, before the first check-in.
 */
async function ensureCompanyLocation(ctx: Context, firstDay: Date) {
  const settings = await api.dashboard.getSettings();
  if (settings.companyLatitude === null || settings.companyLongitude === null) {
    setNow(at(firstDay, hm("07:00")));
    await api.dashboard.updateSettings(
      {
        companyLatitude: FALLBACK_OFFICE.latitude,
        companyLongitude: FALLBACK_OFFICE.longitude,
        attendanceRadiusMeters: 150,
        requireAttendanceLocation: true
      },
      await api.actor(ctx.adminUserId),
      api.from("web")
    );
  }
  ctx.office = officeFrom(await api.dashboard.getSettings());
}

async function loadContext(): Promise<Context> {
  const [employees, teams, departments, skills, leaveTypes, admin, managers] = await Promise.all([
    api.prisma.employee.findMany({
      where: { deletedAt: null, status: EmployeeStatus.ACTIVE },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        userId: true,
        careerLevel: true,
        hireDate: true,
        departmentId: true,
        employeeSkills: { select: { skillId: true, proficiency: true } }
      },
      orderBy: { id: "asc" }
    }),
    api.prisma.team.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        departmentId: true,
        leadId: true,
        members: { where: { isActive: true }, select: { employeeId: true } }
      },
      orderBy: { id: "asc" }
    }),
    api.prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, code: true, managerId: true } }),
    api.prisma.skill.findMany({ select: { id: true, code: true } }),
    api.prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, code: true, annualAllowance: true } }),
    api.prisma.user.findFirst({
      where: { deletedAt: null, userRoles: { some: { role: { name: "ADMIN" } } } },
      select: { id: true },
      orderBy: { id: "asc" }
    }),
    api.prisma.employeeManager.findMany({
      where: { isActive: true, managerType: ManagerType.DIRECT },
      select: { employeeId: true, manager: { select: { userId: true, status: true } } }
    })
  ]);
  if (!admin) {
    throw new Error("No ADMIN user found — run the seed first.");
  }

  const departmentList = departments.map((item) => ({ id: item.id, code: item.code, headId: item.managerId }));
  const userIdByEmployee = new Map(employees.map((item) => [item.id, item.userId]));

  const context: Context = {
    employees: new Map(),
    teams: teams.map((team) => ({
      id: team.id,
      code: team.code,
      name: team.name,
      departmentId: team.departmentId,
      leadId: team.leadId,
      memberIds: team.members.map((member) => member.employeeId)
    })),
    departments: new Map(departmentList.map((item) => [item.id, item])),
    skillIds: new Map(skills.map((skill) => [skill.code, skill.id])),
    leaveTypes: new Map(leaveTypes.map((type) => [type.code, { id: type.id, annualAllowance: type.annualAllowance }])),
    adminUserId: admin.id,
    office: FALLBACK_OFFICE
  };

  for (const employee of employees) {
    const directManager = managers.find(
      (relation) => relation.employeeId === employee.id && relation.manager.status === EmployeeStatus.ACTIVE
    );
    const department = departmentList.find((item) => item.id === employee.departmentId);
    const headUserId =
      department?.headId && department.headId !== employee.id ? userIdByEmployee.get(department.headId) ?? null : null;

    context.employees.set(employee.id, {
      id: employee.id,
      code: employee.employeeCode,
      fullName: employee.fullName,
      userId: employee.userId,
      level: employee.careerLevel,
      hireDate: employee.hireDate,
      departmentId: employee.departmentId,
      isHead: departmentList.some((item) => item.headId === employee.id),
      isLead: teams.some((team) => team.leadId === employee.id),
      managerUserId: directManager?.manager.userId ?? headUserId,
      skills: new Map(employee.employeeSkills.map((skill) => [skill.skillId, skill.proficiency])),
      persona: buildPersona(employee.employeeCode, employee.careerLevel)
    });
  }

  return context;
}

function createTotals(): Totals {
  return {
    days: [],
    attendanceRecords: 0,
    lateCheckIns: 0,
    absences: 0,
    sickLeaves: 0,
    leaveFiled: 0,
    leaveApproved: 0,
    leaveRejected: 0,
    leaveCancelled: 0,
    halfDayLeaves: 0,
    cancelRequested: 0,
    cancelApproved: 0,
    cancelRejected: 0,
    projects: [],
    projectsStarted: [],
    projectsCompleted: [],
    newTasks: 0,
    assignments: 0,
    reassignments: 0,
    aiSuggestions: 0,
    aiPicked: 0,
    started: 0,
    submitted: 0,
    completed: 0,
    completedLate: 0,
    reworks: 0,
    cancelled: 0,
    chats: 0,
    chatLeaves: 0,
    notificationsRead: 0,
    refused: {}
  };
}

// ---------------------------------------------------------------------------
// Acting through the API
// ---------------------------------------------------------------------------

/** The error code of the last request the API refused, for callers that react to it. */
let lastRefusal: string | null = null;

function refusalOf(error: unknown) {
  return error instanceof ApiError ? error : null;
}

/**
 * One request, made at `minute` (company time) on the day being replayed, as
 * the first of `userIds` the API lets do it: a lead first, say, then the
 * department head, then an admin - who a real person would turn to when told
 * "you cannot do that". Any other refusal is counted and the request dropped.
 */
async function act<T>(
  totals: Totals,
  minute: number,
  userIds: Array<number | null | undefined>,
  request: (actor: AuthUser) => Promise<T>
): Promise<T | null> {
  setNow(at(currentDay, minute));
  lastRefusal = null;
  const tried = new Set<number>();
  for (const userId of userIds) {
    if (!userId || tried.has(userId)) {
      continue;
    }
    tried.add(userId);
    try {
      return await request(await api.actor(userId));
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        throw error;
      }
      lastRefusal = refusal.errorCode;
      if (refusal.getStatus() === 403) {
        continue;
      }
      break;
    }
  }
  if (lastRefusal) {
    totals.refused[lastRefusal] = (totals.refused[lastRefusal] ?? 0) + 1;
  }
  return null;
}

// ---------------------------------------------------------------------------
// One simulated workday
// ---------------------------------------------------------------------------

async function simulateDay(ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  random = createRandom(hashString(`omnihr-simulation:${iso(day)}`));

  await settleCancellationRequests(ctx, day, totals);
  await settleLeaveRequests(ctx, day, totals);
  await callInSick(ctx, day, totals);
  const { onLeave, halfOff } = await leaveToday(day);
  const presence = planPresence(ctx, day, onLeave, halfOff, totals);
  await checkIn(ctx, presence, totals);
  await fileLeaveRequests(ctx, day, onLeave, presence, totals);
  await createNewWork(ctx, state, day, totals);
  await assignTasks(ctx, state, day, onLeave, totals);
  await chatWithGenie(presence, totals);
  await progressTasks(ctx, state, day, presence, totals);
  // Leads review at the end of the day, today's submissions included.
  await reviewTasks(ctx, state, day, totals);
  await syncProjects(ctx, state, day, totals);
  await readNotifications(presence, totals);
  await checkOut(ctx, presence, totals);
}

// --- Leave ------------------------------------------------------------------

/** Who decides on an employee's leave: their manager, else an admin. */
function leaveDeciders(ctx: Context, employee: SimEmployee | undefined, preferred?: number | null) {
  return [preferred, employee?.managerUserId, ctx.adminUserId].filter(
    (userId) => userId && userId !== employee?.userId
  );
}

/** Decides pending requests filed before today. */
async function settleLeaveRequests(ctx: Context, day: Date, totals: Totals) {
  const pending = await api.prisma.leaveRequest.findMany({
    where: { status: LeaveRequestStatus.PENDING, createdAt: { lt: at(day, 0) } },
    orderBy: { createdAt: "asc" }
  });

  for (const request of pending) {
    const employee = ctx.employees.get(request.employeeId);
    const started = request.startDate <= day;
    // Managers get to most requests within a couple of days, and always before they start.
    if (employee && !started && !chance(0.55)) {
      continue;
    }
    const minute = randomInt(hm("08:30"), hm("16:30"));
    if (!employee) {
      // Its owner has left: an admin clears it.
      if (await act(totals, minute, [ctx.adminUserId], (actor) => api.leave.cancel(request.id, actor, api.from("web")))) {
        totals.leaveCancelled += 1;
      }
      continue;
    }
    const workedDuringLeave =
      started &&
      (await api.prisma.attendanceRecord.count({
        where: { employeeId: request.employeeId, workDate: { gte: request.startDate, lte: request.endDate, lt: day } }
      })) > 0;
    if (workedDuringLeave || (!started && chance(0.06))) {
      // Plans changed: the employee withdraws it before anyone decides.
      if (await act(totals, minute, [employee.userId], (actor) => api.leave.cancel(request.id, actor, api.from("mobile")))) {
        totals.leaveCancelled += 1;
      }
      continue;
    }

    const deciders = leaveDeciders(ctx, employee);
    if (chance(0.12)) {
      const rejected = await act(totals, minute, deciders, (actor) =>
        api.leave.reject(request.id, { rejectionReason: pick(REJECTION_REASONS) }, actor, api.from("web"))
      );
      if (rejected) {
        totals.leaveRejected += 1;
      }
      continue;
    }
    const approved = await act(totals, minute, deciders, (actor) =>
      api.leave.approve(request.id, actor, api.from("web"))
    );
    if (approved) {
      totals.leaveApproved += 1;
    } else if (lastRefusal === "LEAVE_BALANCE_INSUFFICIENT") {
      // The approve button said no: the manager turns it down instead.
      const rejected = await act(totals, minute + 1, deciders, (actor) =>
        api.leave.reject(
          request.id,
          { rejectionReason: "Không đủ số ngày phép còn lại, em cân nhắc chuyển sang nghỉ không lương." },
          actor,
          api.from("web")
        )
      );
      if (rejected) {
        totals.leaveRejected += 1;
      }
    }
  }
}

/**
 * Approved leave that is still ahead is sometimes withdrawn: the employee
 * asks, the manager (whoever approved it) decides within a few days and
 * always before the leave starts - mostly yes, sometimes "keep it".
 */
async function settleCancellationRequests(ctx: Context, day: Date, totals: Totals) {
  const asked = await api.prisma.leaveRequest.findMany({
    where: { status: LeaveRequestStatus.APPROVED, cancelRequestedAt: { lt: at(day, 0) } },
    orderBy: { cancelRequestedAt: "asc" }
  });
  for (const request of asked) {
    const employee = ctx.employees.get(request.employeeId);
    const due = request.startDate <= addWorkdays(day, 1);
    if (!due && !chance(0.6)) {
      continue;
    }
    const minute = randomInt(hm("08:30"), hm("16:30"));
    const deciders = leaveDeciders(ctx, employee, request.approverUserId);
    if (chance(0.8)) {
      if (await act(totals, minute, deciders, (actor) => api.leave.approveCancellation(request.id, actor, api.from("web")))) {
        totals.cancelApproved += 1;
      }
    } else if (
      await act(totals, minute, deciders, (actor) =>
        api.leave.rejectCancellation(request.id, { rejectionReason: pick(CANCEL_KEEP_REASONS) }, actor, api.from("web"))
      )
    ) {
      totals.cancelRejected += 1;
    }
  }

  const upcoming = await api.prisma.leaveRequest.findMany({
    where: {
      status: LeaveRequestStatus.APPROVED,
      cancelRequestedAt: null,
      startDate: { gt: addWorkdays(day, 2) }
    }
  });
  for (const request of upcoming) {
    const employee = ctx.employees.get(request.employeeId);
    if (!employee || !chance(0.01)) {
      continue;
    }
    const asked = await act(totals, randomInt(hm("08:30"), hm("17:00")), [employee.userId], (actor) =>
      api.leave.cancel(request.id, actor, api.from("mobile"), pick(CANCEL_REASONS))
    );
    if (asked) {
      totals.cancelRequested += 1;
    }
  }
}

/** Called in sick this morning, from the app; the manager approves it first thing. */
async function callInSick(ctx: Context, day: Date, totals: Totals) {
  const sick = ctx.leaveTypes.get("SICK_LEAVE");
  if (!sick) {
    return;
  }
  const { onLeave } = await leaveToday(day);
  for (const employee of ctx.employees.values()) {
    if (!employee.userId || onLeave.has(employee.id) || !hired(employee, day) || !chance(employee.persona.sickRate)) {
      continue;
    }
    const endDate = chance(0.25) ? addWorkdays(day, 1) : day;
    const request = await act(totals, randomInt(hm("06:30"), hm("07:50")), [employee.userId], (actor) =>
      api.leave.create(
        { leaveTypeId: sick.id, startDate: iso(day), endDate: iso(endDate), reason: pick(SICK_REASONS) },
        actor,
        api.from("mobile")
      )
    );
    if (!request) {
      continue;
    }
    totals.sickLeaves += 1;
    const approved = await act(totals, randomInt(hm("08:10"), hm("10:00")), leaveDeciders(ctx, employee), (actor) =>
      api.leave.approve(request.id, actor, api.from("web"))
    );
    if (approved) {
      totals.leaveApproved += 1;
    }
  }
}

/** Who is off today on approved leave, all day or for one shift. */
async function leaveToday(day: Date) {
  const approved = await api.prisma.leaveRequest.findMany({
    where: { status: LeaveRequestStatus.APPROVED, startDate: { lte: day }, endDate: { gte: day } },
    select: { employeeId: true, halfDay: true }
  });
  // A half day off still works the other shift, so it does not make the
  // person unavailable for the day.
  const onLeave = new Set(approved.filter((request) => !request.halfDay).map((request) => request.employeeId));
  const halfOff = new Map<number, LeaveHalf>();
  for (const request of approved) {
    if (request.halfDay && !onLeave.has(request.employeeId)) {
      halfOff.set(request.employeeId, request.halfDay);
    }
  }
  return { onLeave, halfOff };
}

/**
 * Planned leave, filed a few days to a few weeks ahead - usually in the app,
 * sometimes by asking HRGenie. When annual leave has run out, some switch to
 * unpaid leave; the rest give up.
 */
async function fileLeaveRequests(
  ctx: Context,
  day: Date,
  onLeave: Set<number>,
  presence: Map<number, Presence>,
  totals: Totals
) {
  for (const employee of ctx.employees.values()) {
    if (!employee.userId || onLeave.has(employee.id) || !hired(employee, day) || !chance(0.0065)) {
      continue;
    }
    const startDate = addWorkdays(day, randomInt(3, 15));
    const length = weighted<number>([
      [0.5, 0.15],
      [1, 0.45],
      [2, 0.25],
      [3, 0.15]
    ]);
    const halfDay = length === 0.5 ? pick([LeaveHalf.MORNING, LeaveHalf.AFTERNOON]) : null;
    const endDate = halfDay ? startDate : addWorkdays(startDate, length - 1);
    const unpaid = chance(0.1);
    const reason = pick(unpaid ? UNPAID_REASONS : ANNUAL_REASONS);
    const here = presence.get(employee.id);
    const minute = here
      ? randomInt(here.checkIn + 10, Math.max(here.checkIn + 11, (here.checkOut ?? hm("17:00")) - 10))
      : randomInt(hm("19:00"), hm("22:00"));

    if (!unpaid && chance(0.3)) {
      const filed = await askGenieForLeave(employee, startDate, endDate, halfDay, reason, minute, totals);
      if (filed) {
        totals.leaveFiled += 1;
        totals.halfDayLeaves += halfDay ? 1 : 0;
        continue;
      }
    }

    const create = (code: string) =>
      act(totals, minute, [employee.userId], (actor) =>
        api.leave.create(
          {
            leaveTypeId: ctx.leaveTypes.get(code)!.id,
            startDate: iso(startDate),
            endDate: iso(endDate),
            reason,
            ...(halfDay ? { halfDay } : {})
          },
          actor,
          api.from("mobile")
        )
      );
    let request = await create(unpaid ? "UNPAID_LEAVE" : "ANNUAL_LEAVE");
    if (!request && lastRefusal === "LEAVE_BALANCE_INSUFFICIENT" && chance(0.5)) {
      request = await create("UNPAID_LEAVE");
    }
    if (request) {
      totals.leaveFiled += 1;
      totals.halfDayLeaves += halfDay ? 1 : 0;
    }
  }
}

/** "Cho tôi xin nghỉ phép ..." in the chat, then the confirm button on the draft. */
async function askGenieForLeave(
  employee: SimEmployee,
  startDate: Date,
  endDate: Date,
  halfDay: LeaveHalf | null,
  reason: string,
  minute: number,
  totals: Totals
) {
  const when = halfDay
    ? `buổi ${halfDay === LeaveHalf.MORNING ? "sáng" : "chiều"} ngày ${dmy(startDate)}`
    : startDate.getTime() === endDate.getTime()
      ? `ngày ${dmy(startDate)}`
      : `từ ngày ${dmy(startDate)} đến ngày ${dmy(endDate)}`;
  const message = `Cho tôi xin nghỉ phép ${when}, lý do: ${reason.replace(/\.$/, "").toLowerCase()}`;
  const reply = await act(totals, minute, [employee.userId], (actor) =>
    api.chatbot.sendMessage({ message }, actor, api.from("mobile"))
  );
  totals.chats += reply ? 1 : 0;
  const actionId = reply?.pendingAction?.actionId;
  if (!actionId) {
    return false;
  }
  const confirmed = await act(totals, minute + 1, [employee.userId], (actor) =>
    api.chatbot.confirmAction(actionId, actor, api.from("mobile"))
  );
  if (confirmed) {
    totals.chatLeaves += 1;
  }
  return Boolean(confirmed);
}

// --- Attendance ---------------------------------------------------------------

/**
 * Who comes in today and when they arrive and leave, decided up front so the
 * day's work knows how long each person is around. Nothing is recorded yet.
 */
function planPresence(
  ctx: Context,
  day: Date,
  onLeave: Set<number>,
  halfOff: Map<number, LeaveHalf>,
  totals: Totals
) {
  const presence = new Map<number, Presence>();
  for (const employee of ctx.employees.values()) {
    if (!employee.userId || onLeave.has(employee.id) || !hired(employee, day)) {
      continue;
    }
    const { persona } = employee;
    if (chance(persona.absenceRate)) {
      totals.absences += 1;
      continue;
    }

    let checkIn: number;
    let checkOut: number | null;
    const off = halfOff.get(employee.id);
    if (off === LeaveHalf.MORNING) {
      // Morning off on approved leave: in for the afternoon shift.
      checkIn = randomInt(hm("12:40"), hm("13:05"));
      checkOut = randomInt(hm("17:00"), hm("17:40"));
    } else if (off === LeaveHalf.AFTERNOON) {
      // Afternoon off: the morning shift, then gone at noon.
      checkIn = randomInt(hm("07:30"), hm("08:00"));
      checkOut = randomInt(hm("12:00"), hm("12:15"));
    } else if (chance(0.02)) {
      // Personal errand in the morning, afternoon shift only.
      checkIn = randomInt(hm("12:40"), hm("13:10"));
      checkOut = randomInt(hm("17:00"), hm("17:40"));
    } else {
      checkIn = chance(persona.lateRate)
        ? hm("08:00") + randomInt(1, Math.round(10 + (1 - persona.ability) * 45))
        : randomInt(hm("07:30"), hm("08:00"));
      if ((employee.isHead || employee.isLead) && chance(0.25)) {
        checkOut = randomInt(hm("18:00"), hm("19:30"));
      } else if (chance(persona.earlyOutRate)) {
        checkOut = randomInt(hm("16:00"), hm("16:55"));
      } else {
        checkOut = randomInt(hm("17:00"), hm("17:45"));
      }
    }
    if (chance(0.01 + (1 - persona.ability) * 0.02)) {
      checkOut = null; // forgot to check out
    }

    const leftAt = checkOut ?? hm("17:00");
    const lunch = checkIn < hm("12:00") && leftAt > hm("13:00") ? 60 : 0;
    presence.set(employee.id, {
      employee,
      checkIn,
      checkOut,
      hours: Math.max(0, (leftAt - checkIn - lunch) / 60)
    });
  }
  return presence;
}

/** A GPS fix as the app sends it: near the office, a few metres off, fresh. */
function fix(ctx: Context) {
  return {
    latitude: Number((ctx.office.latitude + (random() - 0.5) * PUNCH_SPREAD).toFixed(6)),
    longitude: Number((ctx.office.longitude + (random() - 0.5) * PUNCH_SPREAD).toFixed(6)),
    accuracyMeters: randomInt(4, 35),
    isMocked: false,
    positionAgeSeconds: randomInt(0, 15)
  };
}

async function checkIn(ctx: Context, presence: Map<number, Presence>, totals: Totals) {
  const arrivals = [...presence.values()].sort((a, b) => a.checkIn - b.checkIn);
  for (const person of arrivals) {
    const record = await act(totals, person.checkIn, [person.employee.userId], (actor) =>
      api.attendance.checkIn(actor, fix(ctx), api.from("mobile"))
    );
    if (!record) {
      // Refused (already in, say): no check-out to match either.
      person.checkOut = null;
      continue;
    }
    totals.attendanceRecords += 1;
    if (record.attendanceStatus === AttendanceStatus.LATE) {
      totals.lateCheckIns += 1;
    }
  }
}

async function checkOut(ctx: Context, presence: Map<number, Presence>, totals: Totals) {
  const leaving = [...presence.values()]
    .filter((person) => person.checkOut !== null)
    .sort((a, b) => a.checkOut! - b.checkOut!);
  for (const person of leaving) {
    const record = await act(totals, person.checkOut!, [person.employee.userId], (actor) =>
      api.attendance.checkOut(actor, fix(ctx), api.from("mobile"))
    );
    if (record) {
      totals.attendanceRecords += 1;
    }
  }
}

/** Most people clear their notifications before leaving; some never bother. */
async function readNotifications(presence: Map<number, Presence>, totals: Totals) {
  for (const person of presence.values()) {
    if (!chance(0.35 + person.employee.persona.ability * 0.4)) {
      continue;
    }
    const minute = (person.checkOut ?? hm("17:00")) - randomInt(2, 20);
    if (await act(totals, minute, [person.employee.userId], (actor) => api.notifications.markAllRead(actor))) {
      totals.notificationsRead += 1;
    }
  }
}

// --- HRGenie ------------------------------------------------------------------

/** A handful of people a day ask HRGenie something, sometimes a follow-up too. */
async function chatWithGenie(presence: Map<number, Presence>, totals: Totals) {
  const people = [...presence.values()];
  const count = Math.min(people.length, randomInt(2, 6));
  for (let index = 0; index < count; index += 1) {
    const person = people.splice(Math.floor(random() * people.length), 1)[0];
    const manager = person.employee.isHead || person.employee.isLead;
    const leftAt = person.checkOut ?? hm("17:00");
    let minute = randomInt(person.checkIn + 5, Math.max(person.checkIn + 6, leftAt - 15));
    let conversationId: number | undefined;
    for (let turn = 0; turn < (chance(0.3) ? 2 : 1); turn += 1) {
      const message = pick(manager && chance(0.45) ? MANAGER_QUESTIONS : EMPLOYEE_QUESTIONS);
      const reply = await act(totals, minute, [person.employee.userId], (actor) =>
        api.chatbot.sendMessage({ message, conversationId }, actor, api.from("mobile"))
      );
      if (!reply) {
        break;
      }
      totals.chats += 1;
      conversationId = reply.conversationId;
      minute += randomInt(1, 4);
    }
  }
}

// --- New work -----------------------------------------------------------------

type JobPlan = {
  title: string;
  hours: number;
  startDate: Date;
  dueDate: Date;
  priority: TaskPriority;
  skills: readonly SkillRequirement[];
  /** Kept for new people: always marked Intern-Junior. */
  starter?: boolean;
  /** The level range the lead writes on it; see levelRangeFor. */
  levels: [CareerLevel, CareerLevel] | null;
  hard: boolean;
};

/**
 * When a team's open work falls below this many hours per person, the next
 * sprint is planned; until then nothing new comes in, so work arrives at the
 * pace the team gets through it, not on a fixed clock.
 */
const BACKLOG_HOURS_PER_PERSON = 10;
/**
 * A sprint (a round, outside IT) gives each member about this many subtasks:
 * two weeks of work at one subtask every three days or so.
 */
const SPRINT_SUBTASKS_PER_PERSON = 3;
/** A product project takes new work for this many workdays, then wraps up. */
const PROJECT_BUILD_DAYS: readonly [number, number] = [35, 50];
/** A department opens at most one product project in this many workdays. */
const PROJECT_COOLDOWN_DAYS = 8;
/** A supporting team works on at most this many product projects at once. */
const MAX_PROJECTS_PER_TEAM = 2;
/**
 * The catalogue's hours are for one focused sitting; a subtask as planned in
 * practice - with its reviews, questions and setup - takes a little more, so a
 * person finishes roughly one every three days.
 */
const HOURS_SCALE = 1.35;

const NORMAL_PRIORITIES: ReadonlyArray<readonly [TaskPriority, number]> = [
  [TaskPriority.LOW, 0.15],
  [TaskPriority.MEDIUM, 0.5],
  [TaskPriority.HIGH, 0.27],
  [TaskPriority.URGENT, 0.08]
];
const QUICK_PRIORITIES: ReadonlyArray<readonly [TaskPriority, number]> = [
  [TaskPriority.MEDIUM, 0.35],
  [TaskPriority.HIGH, 0.45],
  [TaskPriority.URGENT, 0.2]
];

/**
 * New work arrives when a team runs low, not on a timetable: the lead asks for
 * the next package of the team's current project, the department head opens a
 * new project when the team has none, and teams with no project work on the
 * department's internal one. On top of that, a few unplanned quick jobs.
 */
async function createNewWork(ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  const backlog = await openHoursByTeam(state);
  const teams = ctx.teams
    .filter((team) => CATALOGS[team.code] && activeMembers(ctx, team).length)
    .sort(() => random() - 0.5);

  for (const team of teams) {
    const members = activeMembers(ctx, team).length;
    if ((backlog.get(team.id) ?? 0) / members >= BACKLOG_HOURS_PER_PERSON) {
      continue;
    }
    const project = currentProject(state, team, day) ?? (await openProject(ctx, state, day, team, totals));
    const added = project
      ? await addProjectPackage(ctx, state, day, team, project, totals)
      : await addInternalPackage(ctx, day, team, totals);
    backlog.set(team.id, (backlog.get(team.id) ?? 0) + added);
  }

  const quickJobs = randomInt(0, 2) + Math.floor(ctx.employees.size / 60);
  const weights = teams.map((team) => [team, activeMembers(ctx, team).length] as const);
  for (let index = 0; index < quickJobs && weights.length; index += 1) {
    await createQuickTask(ctx, day, weighted(weights), totals);
  }
}

/** The team's product project still taking work, the one closing soonest first. */
function currentProject(state: SimulationState, team: SimTeam, day: Date) {
  return Object.entries(state.projects)
    .filter(([, plan]) => plan.teamIds.includes(team.id) && iso(day) <= plan.freeze)
    .sort((a, b) => a[1].freeze.localeCompare(b[1].freeze))
    .map(([id, plan]) => ({ id: Number(id), plan }))[0];
}

/**
 * The department head opens a project for a team that has run out of one -
 * only for the team that leads that kind of project, and not more often than
 * once every few weeks per department. Supporting teams (QA, backend...) join
 * when they have room.
 */
async function openProject(ctx: Context, state: SimulationState, day: Date, team: SimTeam, totals: Totals) {
  const department = ctx.departments.get(team.departmentId);
  const templates = department
    ? (PROJECT_TEMPLATES[department.code] ?? []).filter((template) => template.workstreams[0].team === team.code)
    : [];
  const last = state.lastProjectOn[team.departmentId];
  if (!department || !templates.length || (last && workdaysBetween(dateOnly(last), day) < PROJECT_COOLDOWN_DAYS)) {
    return null;
  }
  const template = pick(templates);

  const topics = template.topics.map((item) => fill(item, day));
  const existing = new Set(
    (
      await api.prisma.project.findMany({
        where: { name: { in: topics.map((item) => fill(template.name, day, item)) } },
        select: { name: true }
      })
    ).map((project) => project.name)
  );
  const fresh = topics.filter((item) => !existing.has(fill(template.name, day, item)));
  const topic = pick(fresh.length ? fresh : topics);
  const baseName = fill(template.name, day, topic);
  const sameName = await api.prisma.project.count({ where: { name: { startsWith: baseName } } });
  const name = sameName ? `${baseName} (giai đoạn ${sameName + 1})` : baseName;
  let code: string;
  do {
    state.sequence += 1;
    code = `${department.code}-${iso(day).slice(2, 4)}${iso(day).slice(5, 7)}-${String(state.sequence).padStart(3, "0")}`;
  } while (await api.prisma.project.findFirst({ where: { code }, select: { id: true } }));

  const partners = template.workstreams
    .slice(1)
    .map((workstream) => ctx.teams.find((item) => item.code === workstream.team))
    .filter(
      (partner): partner is SimTeam =>
        Boolean(partner) &&
        activeMembers(ctx, partner!).length > 0 &&
        Object.values(state.projects).filter(
          (plan) => plan.teamIds.includes(partner!.id) && iso(day) <= plan.freeze
        ).length < MAX_PROJECTS_PER_TEAM
    );
  const start = addWorkdays(day, randomInt(1, 3));
  const freeze = addWorkdays(start, randomInt(PROJECT_BUILD_DAYS[0], PROJECT_BUILD_DAYS[1]));
  const project = await act(totals, randomInt(hm("09:00"), hm("10:30")), headUsers(ctx, department.id), (actor) =>
    api.projects.create(
      {
        code,
        name,
        description: fill(template.description, day, topic),
        status: ProjectStatus.PLANNING,
        startDate: iso(start),
        endDate: iso(addWorkdays(freeze, randomInt(8, 12)))
      },
      actor,
      api.from("web")
    )
  );
  if (!project) {
    return null;
  }
  const plan: ProjectPlan = {
    code,
    topic,
    departmentId: department.id,
    teamIds: [team.id, ...partners.map((partner) => partner.id)],
    start: iso(start),
    freeze: iso(freeze),
    phases: {}
  };
  state.projects[project.id] = plan;
  state.lastProjectOn[department.id] = iso(day);
  totals.projects.push(`${code} — ${name}`);
  return { id: project.id, plan };
}

/**
 * The team's next sprint on a project (a round, outside IT): about two weeks
 * of work for everyone in it, under one team task - "Web: đặt phòng họp -
 * Sprint 3". A three-month project so comes to half a dozen sprints per team.
 */
async function addProjectPackage(
  ctx: Context,
  state: SimulationState,
  day: Date,
  team: SimTeam,
  project: { id: number; plan: ProjectPlan },
  totals: Totals
) {
  const catalog = CATALOGS[team.code];
  const phase = (project.plan.phases[team.id] ?? 0) + 1;
  const start = laterOf(addWorkdays(day, randomInt(0, 2)), dateOnly(project.plan.start));
  const size = Math.max(3, Math.min(16, Math.round(activeMembers(ctx, team).length * SPRINT_SUBTASKS_PER_PERSON)));
  const plans = numberRepeats(planJobs(sprintJobs(catalog, size), start, day, project.plan.topic, false));
  project.plan.titles ??= {};
  const base = (project.plan.titles[team.id] ??= fill(pick(catalog.workstreams), day, project.plan.topic));
  const round = ctx.departments.get(team.departmentId)?.code === "IT" ? "Sprint" : "Đợt";
  const parent = await addTeamTask(
    ctx,
    team,
    project.id,
    `${base} - ${round} ${phase}`,
    plans,
    randomInt(hm("08:45"), hm("11:30")),
    totals
  );
  if (!parent) {
    return 0;
  }
  project.plan.phases[team.id] = phase;
  return plans.reduce((sum, plan) => sum + plan.hours, 0);
}

/** `size` steps of the team's pipeline, going round it from a random point. */
function sprintJobs(catalog: TeamCatalog, size: number) {
  const from = randomInt(0, catalog.pipeline.length - 1);
  return Array.from({ length: size }, (_, index) => catalog.pipeline[(from + index) % catalog.pipeline.length]);
}

/** The same step twice in one sprint is two parts of it: "(phần 2)". */
function numberRepeats(plans: JobPlan[]) {
  const seen = new Map<string, number>();
  return plans.map((plan) => {
    const count = (seen.get(plan.title) ?? 0) + 1;
    seen.set(plan.title, count);
    return count > 1 ? { ...plan, title: `${plan.title} (phần ${count})` } : plan;
  });
}

/** Work for a team with no product project: the department's internal one. */
async function addInternalPackage(ctx: Context, day: Date, team: SimTeam, totals: Totals) {
  const catalog = CATALOGS[team.code];
  const minute = randomInt(hm("08:45"), hm("11:30"));
  const project = await internalProject(ctx, team.departmentId, day, minute - 5, totals);
  if (!project) {
    return 0;
  }
  const topic = fill(pick(catalog.topics), day);
  const plans = planJobs(pipelineSlice(catalog), addWorkdays(day, randomInt(0, 2)), day, topic, false);
  const parent = await addTeamTask(ctx, team, project.id, fill(pick(catalog.workstreams), day, topic), plans, minute, totals);
  return parent ? plans.reduce((sum, plan) => sum + plan.hours, 0) : 0;
}

/** Heads first, then an admin: who may open projects and team tasks. */
function headUsers(ctx: Context, departmentId: number) {
  const department = ctx.departments.get(departmentId);
  const head = department?.headId ? ctx.employees.get(department.headId) : undefined;
  return [head?.userId, ctx.adminUserId];
}

/** Whoever splits a team task and hands out its subtasks: the lead, else the head. */
function leadUsers(ctx: Context, team: SimTeam) {
  const lead = team.leadId ? ctx.employees.get(team.leadId) : undefined;
  return [lead?.userId, ...headUsers(ctx, team.departmentId)];
}

/**
 * The head adds a team task to a project - stretching the project first when
 * the new work runs past its end, as the API would otherwise refuse - and the
 * team lead splits it into subtasks.
 */
async function addTeamTask(
  ctx: Context,
  team: SimTeam,
  projectId: number,
  title: string,
  plans: JobPlan[],
  minute: number,
  totals: Totals
) {
  const catalog = CATALOGS[team.code];
  const dueDate = latest(plans.map((plan) => plan.dueDate))!;
  await coverInProject(ctx, projectId, team.departmentId, dueDate, minute - 1, totals);
  const parent = await act(totals, minute, headUsers(ctx, team.departmentId), (actor) =>
    api.tasks.create(
      {
        projectId,
        teamId: team.id,
        title,
        description: `${team.name} phụ trách, gồm: ${plans.map((plan) => plan.title).join("; ")}.`,
        technologies: [...catalog.technologies],
        priority: highestPriority(plans.map((plan) => plan.priority)),
        startDate: iso(plans[0].startDate),
        dueDate: iso(dueDate),
        estimatedHours: plans.reduce((sum, plan) => sum + plan.hours, 0)
      },
      actor,
      api.from("web")
    )
  );
  if (!parent) {
    return null;
  }
  totals.newTasks += 1;
  let when = minute + randomInt(20, 90);
  for (const plan of plans) {
    await addSubtask(ctx, team, parent.id, plan, when, totals);
    when += randomInt(2, 6);
  }
  return parent;
}

async function addSubtask(ctx: Context, team: SimTeam, parentTaskId: number, plan: JobPlan, minute: number, totals: Totals) {
  const levels = plan.levels;
  const created = await act(totals, minute, leadUsers(ctx, team), (actor) =>
    api.tasks.create(
      {
        parentTaskId,
        title: plan.title,
        priority: plan.priority,
        minLevel: levels?.[0] ?? null,
        maxLevel: levels?.[1] ?? null,
        startDate: iso(plan.startDate),
        dueDate: iso(plan.dueDate),
        estimatedHours: plan.hours,
        requiredSkills: plan.skills
          .filter(([code]) => ctx.skillIds.has(code))
          .map(([code, requiredProficiency, importance]) => ({
            skillId: ctx.skillIds.get(code)!,
            requiredProficiency,
            importance
          }))
      },
      actor,
      api.from("web")
    )
  );
  if (created) {
    totals.newTasks += 1;
  }
  return created;
}

/** Stretches a project's end date to `dueDate` when new work would run past it. */
async function coverInProject(
  ctx: Context,
  projectId: number,
  departmentId: number,
  dueDate: Date,
  minute: number,
  totals: Totals
) {
  const project = await api.prisma.project.findUnique({ where: { id: projectId }, select: { endDate: true } });
  if (project?.endDate && project.endDate < dueDate) {
    await act(totals, minute, headUsers(ctx, departmentId), (actor) =>
      api.projects.update(projectId, { endDate: iso(addWorkdays(dueDate, randomInt(2, 5))) }, actor, api.from("web"))
    );
  }
}

/** The department's internal project for the year, opened by the head the first time it is needed. */
async function internalProject(ctx: Context, departmentId: number, day: Date, minute: number, totals: Totals) {
  const department = ctx.departments.get(departmentId);
  const year = day.getUTCFullYear();
  const code = internalProjectCode(department?.code ?? `D${departmentId}`, year);
  const select = { id: true, code: true, startDate: true, endDate: true } as const;
  const existing = await api.prisma.project.findFirst({ where: { code, deletedAt: null }, select });
  if (existing) {
    return existing;
  }
  const created = await act(totals, minute, headUsers(ctx, departmentId), (actor) =>
    api.projects.create(
      {
        code,
        name: `Vận hành & hỗ trợ nội bộ ${year}`,
        description:
          "Dự án nội bộ theo năm: vận hành, hỗ trợ, sửa lỗi và việc phát sinh ngoài kế hoạch của phòng ban.",
        status: ProjectStatus.ACTIVE,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`
      },
      actor,
      api.from("web")
    )
  );
  return created ? { id: created.id, code: created.code, startDate: created.startDate, endDate: created.endDate } : null;
}

/**
 * Unplanned jobs go under the team's "support" task for the month, in the
 * internal project. Once that task is finished, the head opens another round.
 */
async function createQuickTask(ctx: Context, day: Date, team: SimTeam, totals: Totals) {
  const catalog = CATALOGS[team.code];
  if (!catalog) {
    return;
  }
  const starter = Boolean(catalog.starter?.length) && chance(0.35);
  const [plan] = planJobs(
    [pick(starter ? catalog.starter! : catalog.quick)],
    addWorkdays(day, randomInt(0, 1)),
    day,
    fill(pick(catalog.topics), day),
    true,
    starter
  );
  const minute = randomInt(hm("08:30"), hm("16:00"));

  const baseTitle = `${catalog.supportTitle} ${monthLabel(day)}`;
  const buckets = await api.prisma.task.findMany({
    where: { deletedAt: null, parentTaskId: null, teamId: team.id, title: { startsWith: baseTitle } },
    select: { id: true, status: true, dueDate: true, projectId: true },
    orderBy: { id: "asc" }
  });
  let bucket = buckets.find((item) => item.status !== TaskStatus.DONE && item.status !== TaskStatus.CANCELLED);
  if (!bucket) {
    const project = await internalProject(ctx, team.departmentId, day, minute - 3, totals);
    if (!project) {
      return;
    }
    const dueDate = laterOf(lastWorkdayOfMonth(day), plan.dueDate);
    await coverInProject(ctx, project.id, team.departmentId, dueDate, minute - 2, totals);
    const created = await act(totals, minute - 1, headUsers(ctx, team.departmentId), (actor) =>
      api.tasks.create(
        {
          projectId: project.id,
          teamId: team.id,
          title: buckets.length ? `${baseTitle} (đợt ${buckets.length + 1})` : baseTitle,
          description: "Các yêu cầu hỗ trợ, sửa lỗi và việc phát sinh ngoài kế hoạch trong tháng.",
          technologies: [...catalog.technologies],
          priority: TaskPriority.MEDIUM,
          startDate: iso(day),
          dueDate: iso(dueDate)
        },
        actor,
        api.from("web")
      )
    );
    if (!created) {
      return;
    }
    totals.newTasks += 1;
    bucket = { id: created.id, status: created.status, dueDate: created.dueDate, projectId: created.projectId };
  } else if (bucket.dueDate && bucket.dueDate < plan.dueDate) {
    // The job runs past the support task: the head moves its due date.
    await coverInProject(ctx, bucket.projectId!, team.departmentId, plan.dueDate, minute - 2, totals);
    await act(totals, minute - 1, headUsers(ctx, team.departmentId), (actor) =>
      api.tasks.update(bucket!.id, { dueDate: iso(plan.dueDate) }, actor, api.from("web"))
    );
  }

  await addSubtask(ctx, team, bucket.id, plan, minute, totals);
}

/** Three to five consecutive steps of a team's usual pipeline. */
function pipelineSlice(catalog: TeamCatalog) {
  const size = randomInt(3, Math.min(5, catalog.pipeline.length));
  const from = randomInt(0, catalog.pipeline.length - size);
  return catalog.pipeline.slice(from, from + size);
}

function planJobs(
  jobs: readonly JobTemplate[],
  startDate: Date,
  day: Date,
  topic: string,
  quick: boolean,
  starter = false
): JobPlan[] {
  let cursor = addWorkdays(startDate, 0);
  return jobs.map((template) => {
    const raw = randomInt(template.hours[0], template.hours[1]);
    const hours = quick ? raw : Math.max(1, Math.round(raw * HOURS_SCALE));
    const draft = { hours, skills: template.skills, starter };
    const levels = levelRangeFor(draft);
    const hard = isHard(hours, template.skills, levels?.[0] ?? null);
    // A lead plans two to three focused hours a day on one task - people have
    // several going - plus slack for review. Hard work gets a tighter plan:
    // that is where deadlines slip, and it should be the only place they do.
    const duration = hard
      ? Math.ceil(hours / 3) + randomInt(1, 2)
      : Math.ceil(hours / 2) + randomInt(3, 4);
    const plan: JobPlan = {
      title: fill(template.title, day, topic),
      hours,
      startDate: cursor,
      dueDate: addWorkdays(cursor, duration - 1),
      priority: weighted(quick ? QUICK_PRIORITIES : NORMAL_PRIORITIES),
      skills: template.skills,
      starter,
      levels,
      hard
    };
    // The subtasks of a package are split so several people work on them at
    // once: each starts within a day or so of the one before, not after it.
    cursor = addWorkdays(cursor, randomInt(0, 1));
    return plan;
  });
}

/**
 * Hard work: deep skills (Advanced or Expert), a Middle-and-up level range, or
 * a long job. The same reading the AI ranking makes of a task, near enough.
 */
function isHard(
  hours: number,
  skills: ReadonlyArray<readonly [string, SkillProficiency, TaskSkillImportance]> | Array<{ requiredProficiency: SkillProficiency }>,
  minLevel: CareerLevel | null
) {
  const proficiencies = (skills as ReadonlyArray<unknown>).map((skill) =>
    Array.isArray(skill) ? (skill[1] as SkillProficiency) : (skill as { requiredProficiency: SkillProficiency }).requiredProficiency
  );
  return (
    hours >= 16 ||
    proficiencies.includes(SkillProficiency.ADVANCED) ||
    proficiencies.includes(SkillProficiency.EXPERT) ||
    (minLevel !== null && CAREER_LEVEL_ORDER.indexOf(minLevel) >= CAREER_LEVEL_ORDER.indexOf(CareerLevel.MIDDLE))
  );
}

const CAREER_LEVEL_ORDER: CareerLevel[] = [
  CareerLevel.INTERN,
  CareerLevel.FRESHER,
  CareerLevel.JUNIOR,
  CareerLevel.MIDDLE,
  CareerLevel.SENIOR,
  CareerLevel.LEAD
];

/**
 * The level range a lead writes on a subtask, judged from how big it is and
 * how deep the skills go. Three in ten are left empty - leads do not always
 * fill it in, and the ranking must cope with that.
 */
function levelRangeFor(plan: Pick<JobPlan, "hours" | "skills" | "starter">): [CareerLevel, CareerLevel] | null {
  // Work kept for new people is always marked as such.
  if (plan.starter) {
    return [CareerLevel.INTERN, CareerLevel.JUNIOR];
  }
  if (chance(0.3)) {
    return null;
  }
  const proficiencies = plan.skills.map(([, proficiency]) => proficiency);
  if (proficiencies.includes(SkillProficiency.EXPERT) || plan.hours > 24) {
    return [CareerLevel.MIDDLE, CareerLevel.LEAD];
  }
  if (proficiencies.includes(SkillProficiency.ADVANCED) || plan.hours > 12) {
    return [CareerLevel.JUNIOR, CareerLevel.SENIOR];
  }
  return plan.hours <= 4 ? [CareerLevel.INTERN, CareerLevel.JUNIOR] : [CareerLevel.FRESHER, CareerLevel.MIDDLE];
}

// --- Assignment ---------------------------------------------------------------

/** Open hours past which a lead looks for someone else first (about two days). */
const FULL_LOAD_HOURS = 16;

/** How often a lead asks for AI suggestions before assigning. */
const AI_SUGGESTION_RATE = 0.8;

async function assignTasks(ctx: Context, state: SimulationState, day: Date, onLeave: Set<number>, totals: Totals) {
  const loads = await openHoursByEmployee(state);
  const skillsSelect = { select: { skillId: true, requiredProficiency: true } } as const;

  // Leads hand out subtasks that start within the next few workdays.
  const unassigned = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: null,
      teamId: { not: null },
      status: { in: [TODO, IN_PROGRESS] },
      OR: [{ startDate: null }, { startDate: { lte: addWorkdays(day, 3) } }]
    },
    select: { id: true, title: true, teamId: true, estimatedHours: true, requiredSkills: skillsSelect },
    orderBy: [{ startDate: "asc" }, { id: "asc" }]
  });
  for (const task of unassigned) {
    const team = ctx.teams.find((item) => item.id === task.teamId);
    const assignee = team && chooseAssignee(ctx, team, task.requiredSkills, loads, onLeave, day);
    if (!team || !assignee) {
      continue;
    }
    const minute = randomInt(hm("09:00"), hm("16:00"));
    if (await assign(ctx, team, task.id, assignee, pick(ASSIGN_NOTES), minute, chance(AI_SUGGESTION_RATE), totals)) {
      loads.set(assignee.id, (loads.get(assignee.id) ?? 0) + Number(task.estimatedHours ?? 4));
      totals.assignments += 1;
    }
  }

  // Work held by someone who left, or badly overdue with a weak performer, moves on.
  const stuck = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      teamId: { not: null },
      status: { in: [TODO, IN_PROGRESS] },
      OR: [{ assignee: { status: { not: EmployeeStatus.ACTIVE } } }, { dueDate: { lt: day } }]
    },
    select: {
      id: true,
      title: true,
      teamId: true,
      assigneeId: true,
      dueDate: true,
      estimatedHours: true,
      requiredSkills: skillsSelect
    }
  });
  for (const task of stuck) {
    const current = ctx.employees.get(task.assigneeId!);
    let note: string;
    if (!current) {
      note = "Chuyển giao do người phụ trách cũ đã nghỉ việc";
    } else {
      const lateDays = task.dueDate ? workdaysBetween(task.dueDate, day) : 0;
      if (lateDays < 5 || current.persona.ability >= 0.5 || !chance(0.12)) {
        continue;
      }
      note = `Chuyển giao do chậm tiến độ ${lateDays} ngày làm việc`;
    }
    const team = ctx.teams.find((item) => item.id === task.teamId);
    const assignee = team && chooseAssignee(ctx, team, task.requiredSkills, loads, onLeave, day, task.assigneeId!);
    if (!team || !assignee) {
      continue;
    }
    if (await assign(ctx, team, task.id, assignee, note, randomInt(hm("09:00"), hm("16:00")), chance(0.5), totals)) {
      loads.set(assignee.id, (loads.get(assignee.id) ?? 0) + Number(task.estimatedHours ?? 4));
      totals.reassignments += 1;
    }
  }
}

/**
 * The lead assigns from the web. Usually they ask for AI suggestions first
 * and, when the person they had in mind is on the list, pick them there -
 * which records the pick against the suggestion. Otherwise they assign by
 * hand. Either way the choice is the lead's own (see chooseAssignee): the
 * simulated lead never simply takes the top suggestion, so an evaluation on
 * this history measures the ranking against people's decisions, not itself.
 */
async function assign(
  ctx: Context,
  team: SimTeam,
  taskId: number,
  assignee: SimEmployee,
  note: string,
  minute: number,
  withSuggestions: boolean,
  totals: Totals
) {
  const assigned = await act(totals, minute, leadUsers(ctx, team), async (actor) => {
    if (withSuggestions) {
      try {
        const suggestion = await api.suggestions.generate(
          taskId,
          { limit: 5, includeAvailability: true, includePendingLeave: true, includeSelf: false },
          actor,
          api.from("web")
        );
        totals.aiSuggestions += 1;
        const item = suggestion.items.find((candidate) => candidate.employeeId === assignee.id);
        if (item) {
          setNow(at(currentDay, minute + 1));
          await api.suggestions.select(suggestion.id, { suggestionItemId: item.suggestionItemId, note }, actor, api.from("web"));
          totals.aiPicked += 1;
          return true;
        }
      } catch (error) {
        const refusal = refusalOf(error);
        // No candidates, say: the lead just assigns by hand. Not allowed at
        // all is for act() to handle, by asking someone else.
        if (!refusal || refusal.getStatus() === 403) {
          throw error;
        }
      }
      setNow(at(currentDay, minute + 2));
    }
    await api.tasks.assign(taskId, { assigneeId: assignee.id, note }, actor, api.from("web"));
    return true;
  });
  return Boolean(assigned);
}

function chooseAssignee(
  ctx: Context,
  team: SimTeam,
  required: Array<{ skillId: number; requiredProficiency: SkillProficiency }>,
  loads: Map<number, number>,
  onLeave: Set<number>,
  day: Date,
  excludeId?: number
) {
  const present = activeMembers(ctx, team).filter(
    (employee) => employee.id !== excludeId && !onLeave.has(employee.id) && hired(employee, day)
  );
  // Nobody piles more on someone already holding days of work while a
  // teammate has room; only when everyone is full does it go to the least full.
  const withRoom = present.filter((employee) => (loads.get(employee.id) ?? 0) < FULL_LOAD_HOURS);
  const candidates = withRoom.length ? withRoom : present;
  if (!candidates.length) {
    return null;
  }
  // Sometimes the lead just picks whoever is around.
  if (chance(0.2)) {
    return pick(candidates);
  }
  // Sometimes the lead stretches a junior on purpose, skills or not: the way
  // people learn, and a reason the ranking cannot see.
  const juniors = candidates.filter((employee) => JUNIOR_LEVELS.has(employee.level));
  if (juniors.length && chance(MENTORING_CHANCE)) {
    return juniors.reduce((least, employee) =>
      (loads.get(employee.id) ?? 0) < (loads.get(least.id) ?? 0) ? employee : least
    );
  }

  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const employee of candidates) {
    const skillMatch = required.length
      ? required.reduce((sum, skill) => {
          const has = employee.skills.get(skill.skillId);
          return sum + (has ? Math.min(1, PROFICIENCY_RANK[has] / PROFICIENCY_RANK[skill.requiredProficiency]) : 0);
        }, 0) / required.length
      : 0.5;
    const capacity = 1 - Math.min(1, (loads.get(employee.id) ?? 0) / 40);
    const score =
      0.4 * skillMatch +
      0.4 * capacity -
      (employee.id === team.leadId ? 0.15 : 0) +
      leadAffinity(team.leadId, employee.id) +
      random() * 0.3;
    if (score > bestScore) {
      best = employee;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Why a simulated lead favours someone beyond skills and load: rapport,
 * trust, habit. Fixed per lead-member pair and invisible to the API, which
 * sees none of it - so the replayed history is not just the ranking formula
 * played back, and an evaluation on it cannot score well merely by agreeing
 * with how the simulator chose. Between -0.15 and +0.15.
 */
function leadAffinity(leadId: number | null, employeeId: number) {
  if (leadId === null) {
    return 0;
  }
  return (hash01(`affinity:${leadId}:${employeeId}`) - 0.5) * 0.3;
}

// --- Review and progress --------------------------------------------------------

/** Who reviews a subtask: its team lead, the head when the lead did the work, else an admin. */
function reviewers(ctx: Context, teamId: number | null, departmentId: number | null, assigneeId: number | null) {
  const team = ctx.teams.find((item) => item.id === teamId);
  const department = departmentId ? ctx.departments.get(departmentId) : undefined;
  const lead = team?.leadId && team.leadId !== assigneeId ? ctx.employees.get(team.leadId) : undefined;
  const head = department?.headId && department.headId !== assigneeId ? ctx.employees.get(department.headId) : undefined;
  return [lead?.userId, head?.userId, ctx.adminUserId];
}

/**
 * Submissions get reviewed at the end of the day: accepted - the lead then writes down
 * the hours it took - or sent back for rework. Now and then a task nobody has
 * started is dropped after the requirements change.
 */
async function reviewTasks(ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  const open = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      status: { in: [TODO, IN_REVIEW] }
    },
    select: {
      id: true,
      status: true,
      assigneeId: true,
      teamId: true,
      departmentId: true,
      dueDate: true,
      ...HARDNESS_SELECT
    }
  });

  for (const task of open) {
    const employee = ctx.employees.get(task.assigneeId!);
    const reviewedBy = reviewers(ctx, task.teamId, task.departmentId, task.assigneeId);
    const minute = randomInt(hm("16:30"), hm("17:45"));

    if (task.status === TODO) {
      if (!state.logged[task.id] && chance(0.002)) {
        const dropped = await act(totals, minute, reviewedBy, (actor) =>
          api.tasks.updateStatus(task.id, { status: CANCELLED, note: pick(DROP_NOTES) }, actor, api.from("web"))
        );
        if (dropped) {
          forget(state, task.id);
          totals.cancelled += 1;
        }
      }
      continue;
    }
    if (!employee || !chance(0.9)) {
      continue;
    }
    const passes = chance(
      clamp(employee.persona.passRate * (2 - taskDifficulty(task.id, hardTask(task))) * dayShock(day), 0.15, 0.97)
    );
    if (passes) {
      const accepted = await act(totals, minute, reviewedBy, (actor) =>
        api.tasks.updateStatus(task.id, { status: DONE, note: pick(APPROVE_NOTES) }, actor, api.from("web"))
      );
      if (!accepted) {
        continue;
      }
      const hours = roundHalf(state.logged[task.id] ?? Number(task.estimatedHours ?? 0));
      await act(totals, minute + 1, reviewedBy, (actor) =>
        api.tasks.update(task.id, { actualHours: hours }, actor, api.from("web"))
      );
      forget(state, task.id);
      totals.completed += 1;
      if (task.dueDate && task.dueDate < day) {
        totals.completedLate += 1;
      }
    } else {
      const sentBack = await act(totals, minute, reviewedBy, (actor) =>
        api.tasks.updateStatus(task.id, { status: IN_PROGRESS, note: pick(REWORK_NOTES) }, actor, api.from("web"))
      );
      if (sentBack) {
        const extra = Math.max(0.5, roundHalf(Number(task.estimatedHours ?? 4) * randomBetween(0.1, 0.35)));
        state.rework[task.id] = (state.rework[task.id] ?? 0) + extra;
        totals.reworks += 1;
      }
    }
  }
}

function forget(state: SimulationState, taskId: number) {
  delete state.rework[taskId];
  delete state.logged[taskId];
}

/**
 * A day of work for everyone at the office: they pick up to three of their
 * tasks, start the ones still waiting and hand in what they finish - through
 * the app, where the assignee can only start work and submit it for review.
 */
async function progressTasks(
  ctx: Context,
  state: SimulationState,
  day: Date,
  presence: Map<number, Presence>,
  totals: Totals
) {
  const tasks = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      status: { in: [TODO, IN_PROGRESS] },
      OR: [{ startDate: null }, { startDate: { lte: day } }]
    },
    select: { id: true, status: true, assigneeId: true, priority: true, dueDate: true, ...HARDNESS_SELECT }
  });

  const workable = new Map<number, typeof tasks>();
  for (const task of tasks) {
    workable.set(task.assigneeId!, [...(workable.get(task.assigneeId!) ?? []), task]);
  }

  for (const [employeeId, list] of workable) {
    const person = presence.get(employeeId);
    if (!person || person.hours <= 0) {
      continue;
    }
    const { persona } = person.employee;
    // Everyone puts in a working day; the weaker get less done in it.
    let focus = Math.min(person.hours, (3.2 + persona.ability * 2.8) * randomBetween(0.8, 1.2) * dayShock(day));
    // Everyone loses a day sometimes, not only the weaker half.
    if (chance(0.05 + (1 - persona.ability) * 0.12)) {
      focus *= 0.3; // distracted, stuck, or pulled into meetings all day
    }
    focus = roundHalf(focus);

    // What is due first, then what is already under way, then priority.
    list.sort(
      (a, b) =>
        (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        Number(b.status === IN_PROGRESS) - Number(a.status === IN_PROGRESS) ||
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    );
    const leftAt = person.checkOut ?? hm("17:00");
    let minute = person.checkIn + randomInt(10, 60);
    for (const task of list.slice(0, 3)) {
      if (focus < 0.5) {
        break;
      }
      const needed = hoursNeeded(task.id, Number(task.estimatedHours ?? 4), hardTask(task), persona, state);
      const logged = state.logged[task.id] ?? 0;
      const spent = Math.max(0.5, roundHalf(Math.min(focus, needed - logged)));
      focus -= spent;

      if (task.status === TODO) {
        const started = await act(totals, minute, [person.employee.userId], (actor) =>
          api.tasks.updateStatus(task.id, { status: IN_PROGRESS }, actor, api.from("mobile"))
        );
        if (!started) {
          continue;
        }
        totals.started += 1;
      }
      state.logged[task.id] = logged + spent;
      minute = Math.min(leftAt - 5, minute + Math.round(spent * 60));
      if (logged + spent >= needed) {
        const submitted = await act(totals, minute, [person.employee.userId], (actor) =>
          api.tasks.updateStatus(task.id, { status: IN_REVIEW, note: pick(SUBMIT_NOTES) }, actor, api.from("mobile"))
        );
        if (submitted) {
          totals.submitted += 1;
        }
      }
    }
  }
}

/**
 * How hard a task turns out to be, independent of who takes it: requirements
 * churn, a dependency that is not ready, an estimate that was optimistic.
 *
 * Easy and ordinary work mostly goes to plan; hard work is where estimates
 * miss, so its spread is wide and runs above 1 - which is what makes the few
 * overdue tasks the hard ones. The spread is kept wide on purpose: with a
 * narrow one, how a task ends is almost entirely the assignee's hidden
 * ability, the track-record signal becomes a near-perfect readout of it, and
 * every evaluation built on this data measures the simulator talking to itself.
 */
function taskDifficulty(taskId: number, hard: boolean) {
  const draw = hash01(`difficulty:${taskId}`);
  return hard ? 0.8 + draw * 0.55 : 0.6 + draw * 0.5;
}

/**
 * A shock the whole team shares on a given day - an incident, a release
 * week, half the office in a workshop. Nobody's record should look bad just
 * for having been assigned work that week.
 */
function dayShock(day: Date) {
  return 0.85 + hash01(`shock:${iso(day)}`) * 0.3;
}

/** Hours this person needs to finish a task: slower people need more, rework adds on. */
function hoursNeeded(taskId: number, estimatedHours: number, hard: boolean, persona: Persona, state: SimulationState) {
  return roundHalf((estimatedHours / persona.speed) * taskDifficulty(taskId, hard) + (state.rework[taskId] ?? 0));
}

const HARDNESS_SELECT = {
  estimatedHours: true,
  minLevel: true,
  parentTask: { select: { minLevel: true } },
  requiredSkills: { select: { requiredProficiency: true } }
} as const;

function hardTask(task: {
  estimatedHours: unknown;
  minLevel: CareerLevel | null;
  parentTask: { minLevel: CareerLevel | null } | null;
  requiredSkills: Array<{ requiredProficiency: SkillProficiency }>;
}) {
  return isHard(Number(task.estimatedHours ?? 0), task.requiredSkills, task.minLevel ?? task.parentTask?.minLevel ?? null);
}

/**
 * The department head keeps projects current from the web: a planned
 * project starts on its start date, and a finished one is closed - after the
 * head deletes any team task whose every subtask was dropped, since the API
 * counts that task as still open.
 */
async function syncProjects(ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  const projects = await api.prisma.project.findMany({
    where: { deletedAt: null, status: { in: [ProjectStatus.PLANNING, ProjectStatus.ACTIVE] } },
    select: {
      id: true,
      code: true,
      status: true,
      startDate: true,
      departmentId: true,
      tasks: {
        where: { deletedAt: null },
        select: { id: true, parentTaskId: true, status: true }
      }
    }
  });
  for (const project of projects) {
    const heads = headUsers(ctx, project.departmentId);
    if (project.status === ProjectStatus.PLANNING && project.startDate && project.startDate <= day) {
      const started = await act(totals, randomInt(hm("08:00"), hm("09:00")), heads, (actor) =>
        api.projects.update(project.id, { status: ProjectStatus.ACTIVE }, actor, api.from("web"))
      );
      if (started) {
        totals.projectsStarted.push(project.code);
      }
      continue;
    }
    const subtasks = project.tasks.filter((task) => task.parentTaskId !== null);
    const plan = state.projects[project.id];
    if (
      project.status !== ProjectStatus.ACTIVE ||
      // Still taking new work: a quiet week is not the end of the project.
      (plan && iso(day) <= plan.freeze) ||
      isInternalProjectCode(project.code) ||
      !subtasks.some((task) => task.status === DONE) ||
      !subtasks.every((task) => task.status === DONE || task.status === CANCELLED)
    ) {
      continue;
    }
    const minute = randomInt(hm("16:30"), hm("17:30"));
    for (const parent of project.tasks.filter((task) => task.parentTaskId === null && task.status !== DONE)) {
      await act(totals, minute - 2, heads, (actor) => api.tasks.softDelete(parent.id, actor, api.from("web")));
    }
    const closed = await act(totals, minute, heads, (actor) =>
      api.projects.update(project.id, { status: ProjectStatus.COMPLETED }, actor, api.from("web"))
    );
    if (closed) {
      totals.projectsCompleted.push(project.code);
      delete state.projects[project.id];
    }
  }
}

// --- Shared helpers ---------------------------------------------------------------

/** Hours of open work each person still has, by their own reckoning. */
async function openHoursByEmployee(state: SimulationState) {
  const tasks = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      status: { in: OPEN_TASK_STATUSES }
    },
    select: { id: true, assigneeId: true, estimatedHours: true }
  });
  const loads = new Map<number, number>();
  for (const task of tasks) {
    const remaining = Math.max(1, Number(task.estimatedHours ?? 4) - (state.logged[task.id] ?? 0));
    loads.set(task.assigneeId!, (loads.get(task.assigneeId!) ?? 0) + remaining);
  }
  return loads;
}

/** Remaining hours of open subtasks per team, assigned or not. */
async function openHoursByTeam(state: SimulationState) {
  const tasks = await api.prisma.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      teamId: { not: null },
      status: { in: OPEN_TASK_STATUSES }
    },
    select: { id: true, teamId: true, estimatedHours: true }
  });
  const backlog = new Map<number, number>();
  for (const task of tasks) {
    const remaining = Math.max(1, Number(task.estimatedHours ?? 4) - (state.logged[task.id] ?? 0));
    backlog.set(task.teamId!, (backlog.get(task.teamId!) ?? 0) + remaining);
  }
  return backlog;
}

function activeMembers(ctx: Context, team: SimTeam) {
  return team.memberIds
    .map((id) => ctx.employees.get(id))
    .filter((employee): employee is SimEmployee => Boolean(employee));
}

function hired(employee: SimEmployee, day: Date) {
  return !employee.hireDate || employee.hireDate <= day;
}

function highestPriority(priorities: TaskPriority[]) {
  return priorities.reduce((best, item) => (PRIORITY_RANK[item] > PRIORITY_RANK[best] ? item : best), TaskPriority.LOW);
}

function latest(dates: Date[]) {
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

function laterOf(a: Date, b: Date) {
  return a > b ? a : b;
}

function fill(template: string, day: Date, topic = "") {
  return template.replace("{x}", topic).replace("{month}", monthLabel(day)).replace("{quarter}", quarterLabel(day));
}

function monthLabel(day: Date) {
  return `tháng ${day.getUTCMonth() + 1}/${day.getUTCFullYear()}`;
}

function quarterLabel(day: Date) {
  return `quý ${["I", "II", "III", "IV"][Math.floor(day.getUTCMonth() / 3)]}/${day.getUTCFullYear()}`;
}

let random = createRandom(1);

function randomInt(min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function randomBetween(min: number, max: number) {
  return min + random() * (max - min);
}

function chance(probability: number) {
  return random() < probability;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      return item;
    }
  }
  return entries[entries.length - 1][0];
}

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function companyToday(now: Date) {
  const local = new Date(now.getTime() + TZ_OFFSET_MINUTES * MINUTE_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** 15/05/2026, the way people write a date in a message. */
function dmy(date: Date) {
  const [year, month, day] = iso(date).split("-");
  return `${day}/${month}/${year}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function isWorkday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5 && !holidays.has(date.getTime());
}

/** `count` workdays after `date`, which is first moved forward onto a workday. */
function addWorkdays(date: Date, count: number) {
  let result = date;
  while (!isWorkday(result)) {
    result = addDays(result, 1);
  }
  for (let remaining = count; remaining > 0; ) {
    result = addDays(result, 1);
    if (isWorkday(result)) {
      remaining -= 1;
    }
  }
  return result;
}

/** Workdays in the interval (from, to]. */
function workdaysBetween(from: Date, to: Date) {
  let count = 0;
  for (let day = addDays(from, 1); day <= to; day = addDays(day, 1)) {
    if (isWorkday(day)) {
      count += 1;
    }
  }
  return count;
}

function lastWorkdayOfMonth(date: Date) {
  let result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  while (!isWorkday(result)) {
    result = addDays(result, -1);
  }
  return result;
}

/** A local company time on a work date, as a UTC instant. */
function at(date: Date, minutesAfterMidnight: number) {
  return new Date(date.getTime() + (minutesAfterMidnight - TZ_OFFSET_MINUTES) * MINUTE_MS);
}

function hm(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printSummary(totals: Totals, state: SimulationState) {
  if (!totals.days.length) {
    console.info(`\nKhông có ngày làm việc mới để mô phỏng — dữ liệu đã chạy tới ${state.lastDate}.`);
    return;
  }
  const list = (items: string[]) => (items.length ? items.join(", ") : "—");
  const first = totals.days[0];
  const last = totals.days[totals.days.length - 1];
  console.info(`\nĐã mô phỏng ${totals.days.length} ngày làm việc (${first} → ${last}), mọi thao tác qua API.`);
  console.info(`- Dự án mới: ${totals.projects.length}`);
  console.info(`- Dự án bắt đầu: ${totals.projectsStarted.length}; hoàn thành: ${list(totals.projectsCompleted)}`);
  console.info(
    `- Task: ${totals.newTasks} task mới, ${totals.assignments} lượt giao, ${totals.reassignments} lượt chuyển giao, ` +
      `${totals.started} bắt đầu làm, ${totals.submitted} gửi duyệt, ${totals.completed} hoàn thành ` +
      `(${totals.completedLate} trễ hạn), ${totals.reworks} bị trả về sửa, ${totals.cancelled} bị hủy`
  );
  console.info(
    `- Gợi ý AI: ${totals.aiSuggestions} lần trưởng nhóm xin gợi ý, ${totals.aiPicked} lần chọn người từ danh sách gợi ý`
  );
  console.info(
    `- Chấm công: ${totals.attendanceRecords} bản ghi, ${totals.lateCheckIns} lượt đi muộn, ` +
      `${totals.absences} lượt vắng không phép`
  );
  console.info(
    `- Nghỉ phép: ${totals.sickLeaves} nghỉ ốm, ${totals.leaveFiled} đơn mới (${totals.chatLeaves} qua HRGenie), ` +
      `${totals.leaveApproved} duyệt, ${totals.leaveRejected} từ chối, ${totals.leaveCancelled} rút, ` +
      `${totals.halfDayLeaves} đơn nửa ngày`
  );
  console.info(
    `- Xin hủy đơn đã duyệt: ${totals.cancelRequested} yêu cầu, ${totals.cancelApproved} được hủy, ` +
      `${totals.cancelRejected} giữ nguyên`
  );
  console.info(`- HRGenie: ${totals.chats} tin nhắn; ${totals.notificationsRead} lượt đọc hết thông báo`);
  const refused = Object.entries(totals.refused).sort((a, b) => b[1] - a[1]);
  console.info(
    `- API từ chối: ${refused.length ? refused.map(([code, count]) => `${code} ×${count}`).join(", ") : "—"}`
  );
}

async function printPerformers(ctx: Context, through: Date) {
  const employeeIds = [...ctx.employees.keys()];
  const [done, checkIns] = await Promise.all([
    api.prisma.task.findMany({
      where: { deletedAt: null, parentTaskId: { not: null }, status: DONE, assigneeId: { in: employeeIds } },
      select: { assigneeId: true, dueDate: true, completedAt: true, estimatedHours: true, actualHours: true }
    }),
    api.prisma.attendanceRecord.groupBy({
      by: ["employeeId", "attendanceStatus"],
      where: {
        employeeId: { in: employeeIds },
        recordType: AttendanceRecordType.CHECK_IN,
        workDate: { gt: addDays(through, -30), lte: through }
      },
      _count: { _all: true }
    })
  ]);

  const rows = [...ctx.employees.values()]
    .sort((a, b) => b.persona.ability - a.persona.ability)
    .map((employee) => {
      const tasks = done.filter((task) => task.assigneeId === employee.id);
      const onTime = tasks.filter((task) => !task.dueDate || companyToday(task.completedAt!) <= task.dueDate).length;
      const estimated = tasks.reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0);
      const actual = tasks.reduce((sum, task) => sum + Number(task.actualHours ?? 0), 0);
      const attendance = checkIns.filter((item) => item.employeeId === employee.id);
      const total = attendance.reduce((sum, item) => sum + item._count._all, 0);
      const late = attendance
        .filter((item) => item.attendanceStatus === AttendanceStatus.LATE)
        .reduce((sum, item) => sum + item._count._all, 0);
      const ability = Number(employee.persona.ability.toFixed(2));
      return {
        "Nhân viên": `${employee.code} ${employee.fullName}`,
        "Năng lực ẩn": `${ability >= 0.7 ? "Giỏi" : ability >= 0.45 ? "Khá" : "Yếu"} (${ability.toFixed(2)})`,
        "Task xong": tasks.length,
        "Đúng hạn": tasks.length ? `${Math.round((onTime / tasks.length) * 100)}%` : "—",
        "Giờ thực/ước tính": estimated ? (actual / estimated).toFixed(2) : "—",
        "Đi muộn 30 ngày": `${late}/${total}`
      };
    });

  console.info("\nNhóm làm tốt nhất và kém nhất (theo năng lực ẩn):");
  console.table([...rows.slice(0, 5), ...rows.slice(-5)]);
}

// Only simulate when this file is the entry point.
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
