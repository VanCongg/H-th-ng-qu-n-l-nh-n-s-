/**
 * Company-life simulator that keeps growing the dataset the AI features learn
 * from. Each run replays every workday since the previous run (up to yesterday,
 * company time) as if the company had lived it:
 *
 * - leave: pending requests are approved, rejected or withdrawn; a few people
 *   call in sick, others file annual leave for the coming weeks;
 * - attendance: everyone not on leave checks in and out, with lateness,
 *   forgotten check-outs and the odd unexplained absence;
 * - work: one new project or large team task per day, extra team tasks for
 *   teams running out of work, and a few quick jobs;
 *   leads assign subtasks, people log hours, submit for review, get sent back
 *   for rework, and finish on time or late;
 * - reviews: quarterly cycles open, self reviews trickle in near the end, and
 *   cycles close with ratings computed from the quarter's real task and
 *   attendance data (which feeds the AI assignee performance signal).
 *
 * Every employee has a stable hidden persona (ability, discipline), so the
 * same people keep doing well or badly. Progress is stored in the `simulation`
 * system setting, so a day is never replayed.
 *
 *   npm run prisma:simulate                          # catch up to yesterday
 *   npm run prisma:simulate -- --until 2026-10-02    # or up to a given date
 */
import "dotenv/config";
import {
  AttendanceRecordType,
  AttendanceShift,
  AttendanceStatus,
  CareerLevel,
  EmployeeStatus,
  LeaveRequestStatus,
  ManagerType,
  NotificationType,
  PerformanceReviewStatus,
  Prisma,
  PrismaClient,
  ProjectStatus,
  ReviewCycleStatus,
  SkillProficiency,
  TaskAssignmentType,
  TaskPriority,
  TaskSkillImportance,
  TaskStatus
} from "@prisma/client";

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;

const TZ_OFFSET_MINUTES = 420;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const STATE_KEY = "simulation";
const MAX_DAYS_PER_RUN = 92;
const OFFICE = { latitude: 21.0227, longitude: 105.8466 };
const SHIFTS = [
  { shift: AttendanceShift.MORNING, start: 8 * 60, end: 12 * 60 },
  { shift: AttendanceShift.AFTERNOON, start: 13 * 60, end: 17 * 60 }
];
const EARLY_CHECK_IN_MINUTES = 60;

const { TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED } = TaskStatus;
const OPEN_TASK_STATUSES = [TODO, IN_PROGRESS, IN_REVIEW];
const ACTIVE_LEAVE_STATUSES = [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED];
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
const REVIEW_COMMENTS: Record<number, string> = {
  5: "Hoàn thành xuất sắc mục tiêu, chủ động hỗ trợ đồng nghiệp và đề xuất cải tiến quy trình.",
  4: "Hoàn thành tốt các đầu việc được giao, đúng hạn và chất lượng ổn định.",
  3: "Đáp ứng yêu cầu công việc; cần chủ động hơn trong việc cập nhật tiến độ.",
  2: "Một số đầu việc trễ hạn; cần cải thiện kỹ năng lập kế hoạch và phối hợp.",
  1: "Chưa đạt yêu cầu; cần kế hoạch cải thiện hiệu suất cụ thể trong kỳ tới."
};
const SELF_COMMENTS: Record<number, string> = {
  5: "Tôi đã vượt các mục tiêu chính của kỳ và mong muốn đảm nhận thêm các dự án thử thách hơn.",
  4: "Tôi hoàn thành đầy đủ các mục tiêu đã cam kết và đã cải thiện kỹ năng chuyên môn.",
  3: "Tôi hoàn thành phần lớn công việc; kỳ tới tôi sẽ tập trung quản lý thời gian tốt hơn.",
  2: "Tôi còn trễ hạn một số việc và cần thêm hỗ trợ để cải thiện.",
  1: "Kỳ này tôi chưa đạt kỳ vọng và cần kế hoạch cải thiện rõ ràng."
};

// ---------------------------------------------------------------------------
// Simulation context and state
// ---------------------------------------------------------------------------

type Persona = {
  /** 0..1 — drives speed, review pass rate and focus. */
  ability: number;
  lateRate: number;
  earlyOutRate: number;
  absenceRate: number;
  sickRate: number;
  /** Estimated hours delivered per hour worked. */
  speed: number;
  passRate: number;
};

type SimEmployee = {
  id: number;
  code: string;
  fullName: string;
  userId: number | null;
  level: CareerLevel;
  hireDate: Date | null;
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
  /** Notifications older than this are created as already read. */
  readBefore: Date;
};

type SimulationState = {
  lastDate: string;
  sequence: number;
  /** Extra hours a task still needs after failing review, by task id. */
  rework: Record<string, number>;
  /** Review cycles closed before the simulator started; they seed the personas. */
  baselineCycleIds: number[];
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
  projects: string[];
  projectsStarted: string[];
  projectsCompleted: string[];
  newTasks: number;
  assignments: number;
  reassignments: number;
  started: number;
  submitted: number;
  completed: number;
  completedLate: number;
  reworks: number;
  cancelled: number;
  selfReviews: number;
  reviewsFinalized: number;
  cyclesOpened: string[];
  cyclesClosed: string[];
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The simulator writes synthetic data and refuses to run with NODE_ENV=production.");
  }

  const options = parseArgs(process.argv.slice(2));
  const today = companyToday(new Date());
  const until = options.until ?? addDays(today, -1);
  const state = await loadState();
  const context = await loadContext(state, addDays(until, -2));
  const totals = createTotals();

  let processed = 0;
  for (let day = addDays(dateOnly(state.lastDate), 1); day <= until; day = addDays(day, 1)) {
    if (processed >= options.maxDays) {
      console.warn(`Dừng sau ${options.maxDays} ngày; chạy lại để mô phỏng tiếp.`);
      break;
    }
    processed += 1;

    if (!isWorkday(day)) {
      state.lastDate = iso(day);
      await saveState(prisma, state);
      continue;
    }

    await prisma.$transaction(
      async (tx) => {
        await simulateDay(tx, context, state, day, totals);
        state.lastDate = iso(day);
        await saveState(tx, state);
      },
      { maxWait: 30_000, timeout: 600_000 }
    );
    totals.days.push(iso(day));
    console.info(`✓ ${iso(day)}`);
  }

  printSummary(totals, state);
  await printPerformers(context, dateOnly(state.lastDate));
}

function parseArgs(args: string[]) {
  let until: Date | null = null;
  let maxDays = MAX_DAYS_PER_RUN;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--until") {
      until = dateOnly(args[++index] ?? "");
      if (Number.isNaN(until.getTime())) {
        throw new Error("--until expects a date in YYYY-MM-DD format");
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
  return { until, maxDays };
}

async function loadState(): Promise<SimulationState> {
  const record = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  if (record) {
    const value = record.value as Partial<SimulationState>;
    return {
      lastDate: value.lastDate ?? iso(addDays(companyToday(new Date()), -1)),
      sequence: value.sequence ?? 0,
      rework: value.rework ?? {},
      baselineCycleIds: value.baselineCycleIds ?? []
    };
  }

  // First run: continue right after the seeded attendance history.
  const [latestAttendance, closedCycles] = await Promise.all([
    prisma.attendanceRecord.aggregate({ _max: { workDate: true } }),
    prisma.reviewCycle.findMany({ where: { status: ReviewCycleStatus.CLOSED }, select: { id: true } })
  ]);
  return {
    lastDate: iso(latestAttendance._max.workDate ?? addDays(companyToday(new Date()), -2)),
    sequence: 0,
    rework: {},
    baselineCycleIds: closedCycles.map((cycle) => cycle.id)
  };
}

async function saveState(client: Tx, state: SimulationState) {
  const value = state as unknown as Prisma.InputJsonValue;
  await client.systemSetting.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, value },
    update: { value }
  });
}

async function loadContext(state: SimulationState, readBefore: Date): Promise<Context> {
  const [employees, teams, departments, skills, leaveTypes, admin, managers, baselineReviews] = await Promise.all([
    prisma.employee.findMany({
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
    prisma.team.findMany({
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
    prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, code: true, managerId: true } }),
    prisma.skill.findMany({ select: { id: true, code: true } }),
    prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, code: true, annualAllowance: true } }),
    prisma.user.findFirst({
      where: { deletedAt: null, userRoles: { some: { role: { name: "ADMIN" } } } },
      select: { id: true },
      orderBy: { id: "asc" }
    }),
    prisma.employeeManager.findMany({
      where: { isActive: true, managerType: ManagerType.DIRECT },
      select: { employeeId: true, manager: { select: { userId: true, status: true } } }
    }),
    prisma.performanceReview.findMany({
      where: { cycleId: { in: state.baselineCycleIds }, finalRating: { not: null } },
      select: { employeeId: true, finalRating: true }
    })
  ]);
  if (!admin) {
    throw new Error("No ADMIN user found — run the seed first.");
  }

  const ratings = new Map<number, number[]>();
  for (const review of baselineReviews) {
    ratings.set(review.employeeId, [...(ratings.get(review.employeeId) ?? []), review.finalRating!]);
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
    readBefore
  };

  for (const employee of employees) {
    const directManager = managers.find(
      (relation) => relation.employeeId === employee.id && relation.manager.status === EmployeeStatus.ACTIVE
    );
    const department = departmentList.find((item) => item.id === employee.departmentId);
    const headUserId =
      department?.headId && department.headId !== employee.id ? userIdByEmployee.get(department.headId) ?? null : null;
    const pastRatings = ratings.get(employee.id);

    context.employees.set(employee.id, {
      id: employee.id,
      code: employee.employeeCode,
      fullName: employee.fullName,
      userId: employee.userId,
      level: employee.careerLevel,
      hireDate: employee.hireDate,
      isHead: departmentList.some((item) => item.headId === employee.id),
      isLead: teams.some((team) => team.leadId === employee.id),
      managerUserId: directManager?.manager.userId ?? headUserId,
      skills: new Map(employee.employeeSkills.map((skill) => [skill.skillId, skill.proficiency])),
      persona: buildPersona(
        employee.employeeCode,
        employee.careerLevel,
        pastRatings ? pastRatings.reduce((sum, rating) => sum + rating, 0) / pastRatings.length : null
      )
    });
  }

  return context;
}

/** Stable per employee: the same person is always the same kind of worker. */
function buildPersona(code: string, level: CareerLevel, pastRating: number | null): Persona {
  const talent = hash01(`talent:${code}`);
  const levelBonus: Record<CareerLevel, number> = {
    INTERN: -0.1,
    FRESHER: -0.06,
    JUNIOR: -0.02,
    MIDDLE: 0,
    SENIOR: 0.06,
    LEAD: 0.08
  };
  const base = pastRating === null ? talent : 0.35 * ((pastRating - 1) / 4) + 0.65 * talent;
  const ability = clamp(0.03 + base * 0.97 + levelBonus[level], 0.05, 0.97);
  const discipline = clamp(0.5 * ability + 0.5 * hash01(`discipline:${code}`), 0, 1);
  return {
    ability,
    lateRate: 0.015 + 0.3 * (1 - discipline) ** 2,
    earlyOutRate: 0.01 + 0.08 * (1 - discipline) ** 2,
    absenceRate: 0.002 + 0.02 * (1 - discipline) ** 2,
    sickRate: 0.003 + 0.004 * hash01(`health:${code}`),
    speed: 0.6 + ability * 0.7,
    passRate: 0.5 + ability * 0.45
  };
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
    projects: [],
    projectsStarted: [],
    projectsCompleted: [],
    newTasks: 0,
    assignments: 0,
    reassignments: 0,
    started: 0,
    submitted: 0,
    completed: 0,
    completedLate: 0,
    reworks: 0,
    cancelled: 0,
    selfReviews: 0,
    reviewsFinalized: 0,
    cyclesOpened: [],
    cyclesClosed: []
  };
}

// ---------------------------------------------------------------------------
// One simulated workday
// ---------------------------------------------------------------------------

async function simulateDay(tx: Tx, ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  random = createRandom(hashString(`omnihr-simulation:${iso(day)}`));

  await rollReviewCycles(tx, ctx, day, totals);
  const onLeave = await settleLeaveRequests(tx, ctx, day, totals);
  await fileLeaveRequests(tx, ctx, day, onLeave, totals);
  const presence = await recordAttendance(tx, ctx, day, onLeave, totals);
  await createNewWork(tx, ctx, state, day, totals);
  await assignTasks(tx, ctx, day, onLeave, totals);
  await progressTasks(tx, ctx, state, day, presence, totals);
  await syncParentTasks(tx);
  await syncProjects(tx, day, totals);
}

// --- Leave ------------------------------------------------------------------

/** Decides pending requests and returns who is on approved leave today. */
async function settleLeaveRequests(tx: Tx, ctx: Context, day: Date, totals: Totals) {
  const pending = await tx.leaveRequest.findMany({
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
    const decidedAt = at(day, randomInt(hm("08:30"), hm("16:30")));
    const workedDuringLeave =
      started &&
      (await tx.attendanceRecord.count({
        where: { employeeId: request.employeeId, workDate: { gte: request.startDate, lte: request.endDate, lt: day } }
      })) > 0;

    if (!employee || workedDuringLeave || (!started && chance(0.06))) {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: LeaveRequestStatus.CANCELLED, canceledAt: decidedAt }
      });
      totals.leaveCancelled += 1;
      continue;
    }

    const rejected = chance(0.12);
    const rejectionReason = rejected ? pick(REJECTION_REASONS) : null;
    await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: rejected ? LeaveRequestStatus.REJECTED : LeaveRequestStatus.APPROVED,
        approverUserId: employee.managerUserId ?? ctx.adminUserId,
        approvedAt: rejected ? null : decidedAt,
        rejectionReason
      }
    });
    await notify(tx, ctx, employee.userId, {
      type: rejected ? NotificationType.LEAVE_REJECTED : NotificationType.LEAVE_APPROVED,
      title: rejected ? "Leave request rejected" : "Leave request approved",
      message: rejectionReason ?? `Your leave request from ${iso(request.startDate)} to ${iso(request.endDate)} was approved.`,
      entityType: "LeaveRequest",
      entityId: request.id,
      createdAt: decidedAt
    });
    if (rejected) {
      totals.leaveRejected += 1;
    } else {
      totals.leaveApproved += 1;
    }
  }

  const approved = await tx.leaveRequest.findMany({
    where: { status: LeaveRequestStatus.APPROVED, startDate: { lte: day }, endDate: { gte: day } },
    select: { employeeId: true }
  });
  return new Set(approved.map((request) => request.employeeId));
}

async function fileLeaveRequests(tx: Tx, ctx: Context, day: Date, onLeave: Set<number>, totals: Totals) {
  for (const employee of ctx.employees.values()) {
    if (onLeave.has(employee.id) || (employee.hireDate && employee.hireDate > day)) {
      continue;
    }

    if (chance(employee.persona.sickRate)) {
      // Called in sick this morning; the manager approves it right away.
      for (const endDate of chance(0.25) ? [addWorkdays(day, 1), day] : [day]) {
        const created = await createLeave(tx, ctx, employee, {
          typeCode: "SICK_LEAVE",
          startDate: day,
          endDate,
          reason: pick(SICK_REASONS),
          createdAt: at(day, randomInt(hm("06:30"), hm("07:50"))),
          approvedAt: at(day, randomInt(hm("08:10"), hm("10:00")))
        });
        if (created) {
          onLeave.add(employee.id);
          totals.sickLeaves += 1;
          break;
        }
      }
      continue;
    }

    if (chance(0.0065)) {
      const startDate = addWorkdays(day, randomInt(3, 15));
      const length = weighted<number>([
        [1, 0.55],
        [2, 0.3],
        [3, 0.15]
      ]);
      const unpaid = chance(0.1);
      if (!unpaid && (await annualLeaveUsed(tx, ctx, employee.id, startDate)) + length > annualAllowance(ctx)) {
        continue;
      }
      const created = await createLeave(tx, ctx, employee, {
        typeCode: unpaid ? "UNPAID_LEAVE" : "ANNUAL_LEAVE",
        startDate,
        endDate: addWorkdays(startDate, length - 1),
        reason: pick(unpaid ? UNPAID_REASONS : ANNUAL_REASONS),
        createdAt: at(day, randomInt(hm("08:30"), hm("17:00")))
      });
      if (created) {
        totals.leaveFiled += 1;
      }
    }
  }
}

async function createLeave(
  tx: Tx,
  ctx: Context,
  employee: SimEmployee,
  input: { typeCode: string; startDate: Date; endDate: Date; reason: string; createdAt: Date; approvedAt?: Date }
) {
  const leaveType = ctx.leaveTypes.get(input.typeCode);
  if (!leaveType) {
    return false;
  }
  const overlapping = await tx.leaveRequest.count({
    where: {
      employeeId: employee.id,
      status: { in: ACTIVE_LEAVE_STATUSES },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate }
    }
  });
  if (overlapping) {
    return false;
  }

  const request = await tx.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: input.startDate,
      endDate: input.endDate,
      totalDays: workdaysBetween(addDays(input.startDate, -1), input.endDate),
      reason: input.reason,
      status: input.approvedAt ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.PENDING,
      approverUserId: input.approvedAt ? employee.managerUserId ?? ctx.adminUserId : null,
      approvedAt: input.approvedAt ?? null,
      createdAt: input.createdAt
    }
  });
  if (input.approvedAt) {
    await notify(tx, ctx, employee.userId, {
      type: NotificationType.LEAVE_APPROVED,
      title: "Leave request approved",
      message: `Your leave request from ${iso(input.startDate)} to ${iso(input.endDate)} was approved.`,
      entityType: "LeaveRequest",
      entityId: request.id,
      createdAt: input.approvedAt
    });
  }
  return true;
}

function annualAllowance(ctx: Context) {
  return ctx.leaveTypes.get("ANNUAL_LEAVE")?.annualAllowance ?? 12;
}

async function annualLeaveUsed(tx: Tx, ctx: Context, employeeId: number, date: Date) {
  const leaveType = ctx.leaveTypes.get("ANNUAL_LEAVE");
  if (!leaveType) {
    return Number.POSITIVE_INFINITY;
  }
  const year = date.getUTCFullYear();
  const used = await tx.leaveRequest.aggregate({
    where: {
      employeeId,
      leaveTypeId: leaveType.id,
      status: { in: ACTIVE_LEAVE_STATUSES },
      startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
    },
    _sum: { totalDays: true }
  });
  return used._sum.totalDays ?? 0;
}

// --- Attendance ---------------------------------------------------------------

/**
 * Check-in/out like the mobile app records them (see AttendanceService): the
 * shift comes from the check-in time, LATE after the shift start, EARLY_OUT
 * when checking out before that shift ends. Returns hours at work per person.
 */
async function recordAttendance(tx: Tx, ctx: Context, day: Date, onLeave: Set<number>, totals: Totals) {
  const presence = new Map<number, number>();
  const alreadyRecorded = new Set(
    (
      await tx.attendanceRecord.findMany({
        where: { workDate: day },
        select: { employeeId: true },
        distinct: ["employeeId"]
      })
    ).map((record) => record.employeeId)
  );
  const rows: Prisma.AttendanceRecordCreateManyInput[] = [];

  for (const employee of ctx.employees.values()) {
    if (onLeave.has(employee.id) || (employee.hireDate && employee.hireDate > day)) {
      continue;
    }
    if (alreadyRecorded.has(employee.id)) {
      presence.set(employee.id, 7);
      continue;
    }
    const { persona } = employee;
    if (chance(persona.absenceRate)) {
      totals.absences += 1;
      continue;
    }

    let checkIn: number;
    let checkOut: number | null;
    if (chance(0.02)) {
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

    const shift = SHIFTS.find((item) => checkIn >= item.start - EARLY_CHECK_IN_MINUTES && checkIn <= item.end)!;
    const location = {
      latitude: Number((OFFICE.latitude + (random() - 0.5) * 0.0006).toFixed(6)),
      longitude: Number((OFFICE.longitude + (random() - 0.5) * 0.0006).toFixed(6)),
      source: "MOBILE",
      createdByUserId: employee.userId
    };
    const late = checkIn > shift.start;
    rows.push({
      employeeId: employee.id,
      workDate: day,
      recordType: AttendanceRecordType.CHECK_IN,
      recordedAt: at(day, checkIn),
      shift: shift.shift,
      attendanceStatus: late ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
      ...location
    });
    if (late) {
      totals.lateCheckIns += 1;
    }
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

    const leftAt = checkOut ?? hm("17:00");
    const lunch = checkIn < hm("12:00") && leftAt > hm("13:00") ? 60 : 0;
    presence.set(employee.id, Math.max(0, (leftAt - checkIn - lunch) / 60));
  }

  await tx.attendanceRecord.createMany({ data: rows });
  totals.attendanceRecords += rows.length;
  return presence;
}

// --- New work -----------------------------------------------------------------

type JobPlan = {
  title: string;
  hours: number;
  startDate: Date;
  dueDate: Date;
  priority: TaskPriority;
  skills: readonly SkillRequirement[];
};

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

/** One project or large team task a day, plus a few unplanned quick jobs. */
async function createNewWork(tx: Tx, ctx: Context, state: SimulationState, day: Date, totals: Totals) {
  const loads = await openHoursByEmployee(tx);
  const teams = ctx.teams.filter((team) => CATALOGS[team.code] && activeMembers(ctx, team).length);
  if (!teams.length) {
    return;
  }
  // Teams with spare capacity are more likely to get new work.
  const teamWeights = teams.map((team) => {
    const members = activeMembers(ctx, team);
    const load = members.reduce((sum, member) => sum + (loads.get(member.id) ?? 0), 0) / members.length;
    return [team, members.length / (1 + load / 25)] as const;
  });

  const mainTeam = weighted(teamWeights);
  const department = ctx.departments.get(mainTeam.departmentId);
  const departmentTemplates = department ? PROJECT_TEMPLATES[department.code] ?? [] : [];
  // A project is led by the team whose turn it is (the first workstream).
  const ledByTeam = departmentTemplates.filter((template) => template.workstreams[0].team === mainTeam.code);
  const templates = ledByTeam.length ? ledByTeam : departmentTemplates;
  const projectCreated =
    department && templates.length && chance(0.3)
      ? await createProject(tx, ctx, state, day, department, pick(templates), totals)
      : false;
  if (!projectCreated) {
    await createTeamTask(tx, ctx, day, mainTeam, {}, totals);
  }

  // Teams about to run out of work get a new team task so nobody idles for long.
  const backlog = await openHoursByTeam(tx);
  const starving = teams.filter((team) => {
    const members = activeMembers(ctx, team).length;
    return team !== mainTeam && (backlog.get(team.id) ?? 0) / members < 14;
  });
  for (const team of starving.sort(() => random() - 0.5).slice(0, 4)) {
    await createTeamTask(tx, ctx, day, team, {}, totals);
  }

  const quickJobs = randomInt(1, 2) + Math.floor(ctx.employees.size / 40);
  for (let index = 0; index < quickJobs; index += 1) {
    await createQuickTask(tx, ctx, day, weighted(teamWeights), totals);
  }
}

async function createProject(
  tx: Tx,
  ctx: Context,
  state: SimulationState,
  day: Date,
  department: SimDepartment,
  template: ProjectTemplate,
  totals: Totals
) {
  const head = department.headId ? ctx.employees.get(department.headId) : undefined;
  if (!head) {
    return false;
  }

  const topics = template.topics.map((item) => fill(item, day));
  const existing = new Set(
    (
      await tx.project.findMany({
        where: { name: { in: topics.map((item) => fill(template.name, day, item)) } },
        select: { name: true }
      })
    ).map((project) => project.name)
  );
  const fresh = topics.filter((item) => !existing.has(fill(template.name, day, item)));
  const topic = pick(fresh.length ? fresh : topics);
  const baseName = fill(template.name, day, topic);
  const sameName = await tx.project.count({ where: { name: { startsWith: baseName } } });
  const name = sameName ? `${baseName} (giai đoạn ${sameName + 1})` : baseName;
  let code: string;
  do {
    state.sequence += 1;
    code = `${department.code}-${iso(day).slice(2, 4)}${iso(day).slice(5, 7)}-${String(state.sequence).padStart(3, "0")}`;
  } while (await tx.project.findUnique({ where: { code }, select: { id: true } }));

  // Only a department head creates a project, and they manage it.
  const startDate = addWorkdays(day, randomInt(1, 7));
  const project = await tx.project.create({
    data: {
      code,
      name,
      description: fill(template.description, day, topic),
      status: ProjectStatus.PLANNING,
      departmentId: department.id,
      managerId: head.id,
      createdByUserId: head.userId,
      startDate,
      endDate: startDate,
      createdAt: at(day, randomInt(hm("09:00"), hm("11:30")))
    }
  });

  let lastDue = startDate;
  for (const workstream of template.workstreams) {
    const team = ctx.teams.find((item) => item.code === workstream.team);
    if (!team || !activeMembers(ctx, team).length) {
      continue;
    }
    const dueDate = await createTeamTask(
      tx,
      ctx,
      day,
      team,
      {
        projectId: project.id,
        topic,
        startDate: addWorkdays(startDate, randomInt(workstream.offset[0], workstream.offset[1])),
        pick: workstream.pick,
        creatorUserId: head.userId
      },
      totals
    );
    if (dueDate && dueDate > lastDue) {
      lastDue = dueDate;
    }
  }

  await tx.project.update({ where: { id: project.id }, data: { endDate: addWorkdays(lastDue, randomInt(2, 6)) } });
  totals.projects.push(`${code} — ${name}`);
  return true;
}

/** Creates a team-level task with its subtasks; returns the team task's due date. */
async function createTeamTask(
  tx: Tx,
  ctx: Context,
  day: Date,
  team: SimTeam,
  options: {
    projectId?: number | null;
    topic?: string;
    startDate?: Date;
    pick?: readonly number[];
    creatorUserId?: number | null;
  },
  totals: Totals
) {
  const catalog = CATALOGS[team.code];
  if (!catalog) {
    return null;
  }

  const topic = options.topic ?? fill(pick(catalog.topics), day);
  let jobs: JobTemplate[];
  if (options.pick) {
    jobs = options.pick.map((index) => catalog.pipeline[index]).filter(Boolean);
  } else {
    const size = randomInt(3, Math.min(5, catalog.pipeline.length));
    const from = randomInt(0, catalog.pipeline.length - size);
    jobs = catalog.pipeline.slice(from, from + size);
  }

  let projectId = options.projectId;
  if (projectId === undefined) {
    // Extra scope only goes to open projects this team already works on.
    const projects = await tx.project.findMany({
      where: {
        deletedAt: null,
        departmentId: team.departmentId,
        status: { in: [ProjectStatus.ACTIVE, ProjectStatus.PLANNING] },
        tasks: { some: { teamId: team.id, deletedAt: null } }
      },
      select: { id: true }
    });
    projectId = projects.length && chance(0.75) ? pick(projects).id : null;
  }

  const leadUserId = leadUserOf(ctx, team);
  const creatorUserId = options.creatorUserId ?? leadUserId;
  const createdAt = at(day, randomInt(hm("08:45"), hm("11:30")));
  const plans = planJobs(jobs, options.startDate ?? addWorkdays(day, randomInt(0, 3)), day, topic, false);

  const parent = await tx.task.create({
    data: {
      title: fill(pick(catalog.workstreams), day, topic),
      description: `${team.name} phụ trách, gồm: ${plans.map((plan) => plan.title).join("; ")}.`,
      technologies: [...catalog.technologies],
      projectId,
      departmentId: team.departmentId,
      teamId: team.id,
      priority: highestPriority(plans.map((plan) => plan.priority)),
      status: TODO,
      createdByUserId: creatorUserId,
      assignedByUserId: creatorUserId,
      startDate: plans[0].startDate,
      dueDate: latest(plans.map((plan) => plan.dueDate)),
      estimatedHours: plans.reduce((sum, plan) => sum + plan.hours, 0),
      actualHours: 0,
      createdAt
    }
  });
  for (const plan of plans) {
    await createSubtask(tx, ctx, team, parent.id, projectId, plan, leadUserId, createdAt);
  }

  totals.newTasks += 1 + plans.length;
  return parent.dueDate;
}

/** Unplanned jobs go under the team's "support" task for the month. */
async function createQuickTask(tx: Tx, ctx: Context, day: Date, team: SimTeam, totals: Totals) {
  const catalog = CATALOGS[team.code];
  if (!catalog) {
    return;
  }

  const leadUserId = leadUserOf(ctx, team);
  const title = `${catalog.supportTitle} ${monthLabel(day)}`;
  const [plan] = planJobs([pick(catalog.quick)], addWorkdays(day, randomInt(0, 1)), day, fill(pick(catalog.topics), day), true);
  const createdAt = at(day, randomInt(hm("08:30"), hm("16:00")));

  let bucket = await tx.task.findFirst({
    where: { deletedAt: null, parentTaskId: null, teamId: team.id, title }
  });
  if (!bucket) {
    bucket = await tx.task.create({
      data: {
        title,
        description: "Các yêu cầu hỗ trợ, sửa lỗi và việc phát sinh ngoài kế hoạch trong tháng.",
        technologies: [...catalog.technologies],
        departmentId: team.departmentId,
        teamId: team.id,
        priority: TaskPriority.MEDIUM,
        status: TODO,
        createdByUserId: leadUserId,
        assignedByUserId: leadUserId,
        startDate: day,
        dueDate: lastWorkdayOfMonth(day),
        estimatedHours: 0,
        actualHours: 0,
        createdAt: at(day, hm("08:30"))
      }
    });
    totals.newTasks += 1;
  }

  await createSubtask(tx, ctx, team, bucket.id, bucket.projectId, plan, leadUserId, createdAt);
  await tx.task.update({
    where: { id: bucket.id },
    data: {
      estimatedHours: { increment: plan.hours },
      priority: highestPriority([bucket.priority, plan.priority]),
      dueDate: bucket.dueDate && bucket.dueDate >= plan.dueDate ? undefined : plan.dueDate
    }
  });
  totals.newTasks += 1;
}

function planJobs(jobs: readonly JobTemplate[], startDate: Date, day: Date, topic: string, quick: boolean): JobPlan[] {
  let cursor = addWorkdays(startDate, 0);
  return jobs.map((template) => {
    const hours = randomInt(template.hours[0], template.hours[1]);
    // Planned at roughly 5 focused hours a day, plus slack and a day for review.
    const duration = quick ? Math.ceil(hours / 6) + randomInt(1, 2) : Math.ceil(hours / 5) + randomInt(2, 3);
    const plan: JobPlan = {
      title: fill(template.title, day, topic),
      hours,
      startDate: cursor,
      dueDate: addWorkdays(cursor, duration - 1),
      priority: weighted(quick ? QUICK_PRIORITIES : NORMAL_PRIORITIES),
      skills: template.skills
    };
    cursor = addWorkdays(cursor, Math.max(1, Math.ceil(duration * 0.6)));
    return plan;
  });
}

async function createSubtask(
  tx: Tx,
  ctx: Context,
  team: SimTeam,
  parentTaskId: number,
  projectId: number | null,
  plan: JobPlan,
  createdByUserId: number,
  createdAt: Date
) {
  await tx.task.create({
    data: {
      parentTaskId,
      title: plan.title,
      projectId,
      departmentId: team.departmentId,
      teamId: team.id,
      priority: plan.priority,
      status: TODO,
      createdByUserId,
      startDate: plan.startDate,
      dueDate: plan.dueDate,
      estimatedHours: plan.hours,
      actualHours: 0,
      createdAt,
      requiredSkills: {
        create: plan.skills
          .filter(([code]) => ctx.skillIds.has(code))
          .map(([code, requiredProficiency, importance]) => ({
            skillId: ctx.skillIds.get(code)!,
            requiredProficiency,
            importance
          }))
      }
    }
  });
}

// --- Assignment ---------------------------------------------------------------

async function assignTasks(tx: Tx, ctx: Context, day: Date, onLeave: Set<number>, totals: Totals) {
  const loads = await openHoursByEmployee(tx);
  const skillsSelect = { select: { skillId: true, requiredProficiency: true } } as const;

  // Leads hand out subtasks that start within the next few workdays.
  const unassigned = await tx.task.findMany({
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
    await assign(tx, ctx, team, task, assignee, TaskAssignmentType.MANUAL, pick(ASSIGN_NOTES), day);
    loads.set(assignee.id, (loads.get(assignee.id) ?? 0) + Number(task.estimatedHours ?? 4));
    totals.assignments += 1;
  }

  // Work held by someone who left, or badly overdue with a weak performer, moves on.
  const stuck = await tx.task.findMany({
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
    await assign(tx, ctx, team, task, assignee, TaskAssignmentType.REASSIGNED, note, day);
    loads.set(assignee.id, (loads.get(assignee.id) ?? 0) + Number(task.estimatedHours ?? 4));
    totals.reassignments += 1;
  }
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
  const candidates = activeMembers(ctx, team).filter(
    (employee) =>
      employee.id !== excludeId && !onLeave.has(employee.id) && !(employee.hireDate && employee.hireDate > day)
  );
  if (!candidates.length) {
    return null;
  }
  // Sometimes the lead just picks whoever is around.
  if (chance(0.2)) {
    return pick(candidates);
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
    const score = 0.4 * skillMatch + 0.4 * capacity - (employee.id === team.leadId ? 0.15 : 0) + random() * 0.4;
    if (score > bestScore) {
      best = employee;
      bestScore = score;
    }
  }
  return best;
}

async function assign(
  tx: Tx,
  ctx: Context,
  team: SimTeam,
  task: { id: number; title: string },
  assignee: SimEmployee,
  assignmentType: TaskAssignmentType,
  note: string,
  day: Date
) {
  const assignedByUserId = leadUserOf(ctx, team);
  const assignedAt = at(day, randomInt(hm("09:00"), hm("16:00")));
  await tx.task.update({ where: { id: task.id }, data: { assigneeId: assignee.id, assignedByUserId } });
  await tx.taskAssignment.create({
    data: { taskId: task.id, assigneeId: assignee.id, assignedByUserId, assignmentType, note, assignedAt }
  });
  await notify(tx, ctx, assignee.userId, {
    type: NotificationType.TASK_ASSIGNED,
    title: "New task assigned",
    message: `You were assigned to "${task.title}".`,
    entityType: "Task",
    entityId: task.id,
    createdAt: assignedAt
  });
}

// --- Progress -----------------------------------------------------------------

async function progressTasks(
  tx: Tx,
  ctx: Context,
  state: SimulationState,
  day: Date,
  presence: Map<number, number>,
  totals: Totals
) {
  const tasks = await tx.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      status: { in: OPEN_TASK_STATUSES }
    },
    select: {
      id: true,
      title: true,
      status: true,
      assigneeId: true,
      priority: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
      actualHours: true
    }
  });

  // Yesterday's submissions get reviewed: accepted, or sent back for rework.
  for (const task of tasks) {
    const employee = ctx.employees.get(task.assigneeId!);
    if (task.status !== IN_REVIEW || !employee || !chance(0.75)) {
      continue;
    }
    const reviewedAt = at(day, randomInt(hm("10:00"), hm("17:15")));
    if (chance(employee.persona.passRate)) {
      await tx.task.update({ where: { id: task.id }, data: { status: DONE, completedAt: reviewedAt } });
      delete state.rework[task.id];
      task.status = DONE;
      totals.completed += 1;
      if (task.dueDate && task.dueDate < day) {
        totals.completedLate += 1;
      }
    } else {
      const extra = Math.max(0.5, roundHalf(Number(task.estimatedHours ?? 4) * randomBetween(0.1, 0.35)));
      state.rework[task.id] = (state.rework[task.id] ?? 0) + extra;
      await tx.task.update({ where: { id: task.id }, data: { status: IN_PROGRESS } });
      task.status = IN_PROGRESS;
      totals.reworks += 1;
      await notify(tx, ctx, employee.userId, {
        type: NotificationType.TASK_STATUS_CHANGED,
        title: "Task returned for rework",
        message: `"${task.title}" needs changes before it can be accepted.`,
        entityType: "Task",
        entityId: task.id,
        createdAt: reviewedAt
      });
    }
  }

  // Occasionally a task that never started is dropped after requirements change.
  for (const task of tasks) {
    if (task.status === TODO && Number(task.actualHours ?? 0) === 0 && chance(0.002)) {
      await tx.task.update({ where: { id: task.id }, data: { status: CANCELLED } });
      delete state.rework[task.id];
      task.status = CANCELLED;
      totals.cancelled += 1;
    }
  }

  const workable = new Map<number, typeof tasks>();
  for (const task of tasks) {
    if ((task.status === TODO || task.status === IN_PROGRESS) && (!task.startDate || task.startDate <= day)) {
      workable.set(task.assigneeId!, [...(workable.get(task.assigneeId!) ?? []), task]);
    }
  }

  for (const [employeeId, list] of workable) {
    const employee = ctx.employees.get(employeeId);
    const hoursAtWork = presence.get(employeeId) ?? 0;
    if (!employee || hoursAtWork <= 0) {
      continue;
    }
    const { persona } = employee;
    let focus = Math.min(hoursAtWork, (2.5 + persona.ability * 3.5) * randomBetween(0.75, 1.2));
    if (chance((1 - persona.ability) * 0.2)) {
      focus *= 0.3; // distracted, stuck, or pulled into meetings all day
    }
    focus = roundHalf(focus);

    list.sort(
      (a, b) =>
        Number(b.status === IN_PROGRESS) - Number(a.status === IN_PROGRESS) ||
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
        (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
    );
    for (const task of list.slice(0, 3)) {
      if (focus < 0.5) {
        break;
      }
      const needed = hoursNeeded(task.id, Number(task.estimatedHours ?? 4), persona, state);
      const actual = Number(task.actualHours ?? 0);
      const spent = Math.max(0.5, roundHalf(Math.min(focus, needed - actual)));
      const finished = actual + spent >= needed;
      focus -= spent;
      await tx.task.update({
        where: { id: task.id },
        data: { actualHours: actual + spent, status: finished ? IN_REVIEW : IN_PROGRESS }
      });
      if (task.status === TODO) {
        totals.started += 1;
      }
      if (finished) {
        totals.submitted += 1;
      }
    }
  }
}

/** Hours this person needs to finish a task: slower people need more, rework adds on. */
function hoursNeeded(taskId: number, estimatedHours: number, persona: Persona, state: SimulationState) {
  const complexity = 0.85 + hash01(`complexity:${taskId}`) * 0.35;
  return roundHalf((estimatedHours / persona.speed) * complexity + (state.rework[taskId] ?? 0));
}

/** Mirrors TasksService.syncParentStatus, dating completion from the subtasks. */
async function syncParentTasks(tx: Tx) {
  const parents = await tx.task.findMany({
    where: { deletedAt: null, parentTaskId: null, childTasks: { some: { deletedAt: null } } },
    select: { id: true, status: true, actualHours: true, completedAt: true }
  });
  const children = await tx.task.findMany({
    where: { deletedAt: null, parentTaskId: { not: null } },
    select: { parentTaskId: true, status: true, actualHours: true, completedAt: true }
  });
  const byParent = new Map<number, typeof children>();
  for (const child of children) {
    byParent.set(child.parentTaskId!, [...(byParent.get(child.parentTaskId!) ?? []), child]);
  }

  for (const parent of parents) {
    const subtasks = byParent.get(parent.id) ?? [];
    const statuses = subtasks.map((child) => child.status).filter((status) => status !== CANCELLED);
    let status: TaskStatus = TODO;
    if (statuses.length && statuses.every((item) => item === DONE)) {
      status = DONE;
    } else if (statuses.some((item) => item === IN_PROGRESS || item === IN_REVIEW || item === DONE)) {
      status = IN_PROGRESS;
    }
    const actualHours = subtasks.reduce((sum, child) => sum + Number(child.actualHours ?? 0), 0);
    const completedAt =
      status === DONE
        ? latest(subtasks.map((child) => child.completedAt).filter((value): value is Date => Boolean(value))) ??
          parent.completedAt
        : null;

    if (
      status !== parent.status ||
      actualHours !== Number(parent.actualHours ?? 0) ||
      completedAt?.getTime() !== parent.completedAt?.getTime()
    ) {
      await tx.task.update({ where: { id: parent.id }, data: { status, actualHours, completedAt } });
    }
  }
}

async function syncProjects(tx: Tx, day: Date, totals: Totals) {
  const projects = await tx.project.findMany({
    where: { deletedAt: null, status: { in: [ProjectStatus.PLANNING, ProjectStatus.ACTIVE] } },
    select: {
      id: true,
      code: true,
      status: true,
      startDate: true,
      tasks: { where: { deletedAt: null, parentTaskId: { not: null } }, select: { status: true } }
    }
  });
  for (const project of projects) {
    let status = project.status;
    if (status === ProjectStatus.PLANNING && project.startDate && project.startDate <= day) {
      status = ProjectStatus.ACTIVE;
      totals.projectsStarted.push(project.code);
    }
    if (
      status === ProjectStatus.ACTIVE &&
      project.tasks.some((task) => task.status === DONE) &&
      project.tasks.every((task) => task.status === DONE || task.status === CANCELLED)
    ) {
      status = ProjectStatus.COMPLETED;
      totals.projectsCompleted.push(project.code);
    }
    if (status !== project.status) {
      await tx.project.update({ where: { id: project.id }, data: { status } });
    }
  }
}

// --- Performance reviews --------------------------------------------------------

async function rollReviewCycles(tx: Tx, ctx: Context, day: Date, totals: Totals) {
  const ended = await tx.reviewCycle.findMany({
    where: { status: ReviewCycleStatus.OPEN, endDate: { lt: day } },
    orderBy: { endDate: "asc" }
  });
  for (const cycle of ended) {
    await finalizeCycle(tx, ctx, cycle, day, totals);
  }

  const current = await tx.reviewCycle.findFirst({
    where: { startDate: { lte: day }, endDate: { gte: day } },
    orderBy: { startDate: "desc" }
  });
  if (!current) {
    const quarter = Math.floor(day.getUTCMonth() / 3);
    const year = day.getUTCFullYear();
    const name = `Đánh giá hiệu suất quý ${["I", "II", "III", "IV"][quarter]}/${year}`;
    const cycle = await tx.reviewCycle.create({
      data: {
        name,
        startDate: new Date(Date.UTC(year, quarter * 3, 1)),
        endDate: new Date(Date.UTC(year, quarter * 3 + 3, 0)),
        status: ReviewCycleStatus.OPEN,
        createdAt: at(day, hm("08:30"))
      }
    });
    await tx.performanceReview.createMany({
      data: [...ctx.employees.values()]
        .filter((employee) => !(employee.hireDate && employee.hireDate > day))
        .map((employee) => ({ cycleId: cycle.id, employeeId: employee.id, createdAt: at(day, hm("08:30")) }))
    });
    totals.cyclesOpened.push(name);
    return;
  }

  // Self reviews trickle in over the last two weeks; stronger people submit earlier.
  if (current.status === ReviewCycleStatus.OPEN && workdaysBetween(day, current.endDate) <= 8) {
    const pending = await tx.performanceReview.findMany({
      where: { cycleId: current.id, status: PerformanceReviewStatus.PENDING_SELF }
    });
    for (const review of pending) {
      const employee = ctx.employees.get(review.employeeId);
      if (!employee || !chance(0.08 + employee.persona.ability * 0.2)) {
        continue;
      }
      const selfRating = clamp(Math.round(1.5 + employee.persona.ability * 3.5 + random() * 0.8), 1, 5);
      await tx.performanceReview.update({
        where: { id: review.id },
        data: {
          status: PerformanceReviewStatus.SELF_SUBMITTED,
          selfRating,
          selfComment: SELF_COMMENTS[selfRating],
          submittedAt: at(day, randomInt(hm("09:00"), hm("17:00")))
        }
      });
      totals.selfReviews += 1;
    }
  }
}

/** Closes a cycle with ratings earned from the cycle's actual tasks and attendance. */
async function finalizeCycle(
  tx: Tx,
  ctx: Context,
  cycle: { id: number; name: string; startDate: Date; endDate: Date },
  day: Date,
  totals: Totals
) {
  const reviews = await tx.performanceReview.findMany({ where: { cycleId: cycle.id } });
  const reviewed = new Set(reviews.map((review) => review.employeeId));
  for (const employee of ctx.employees.values()) {
    if (reviewed.has(employee.id) || (employee.hireDate && employee.hireDate > cycle.endDate)) {
      continue;
    }
    reviews.push(
      await tx.performanceReview.create({
        data: { cycleId: cycle.id, employeeId: employee.id, createdAt: at(cycle.startDate, hm("09:00")) }
      })
    );
  }

  for (const review of reviews) {
    const employee = ctx.employees.get(review.employeeId);
    if (!employee || review.status === PerformanceReviewStatus.FINALIZED) {
      continue;
    }

    const metrics = await cycleMetrics(tx, employee.id, cycle);
    const punctuality = 1 - Math.min(1, metrics.lateRate * 3);
    const backlog = 1 - Math.min(1, metrics.overdueOpen / 3);
    const score =
      metrics.done >= 2
        ? 0.5 * (metrics.onTime / metrics.done) + 0.2 * metrics.efficiency + 0.15 * punctuality + 0.15 * backlog
        : 0.55 * employee.persona.ability + 0.25 * punctuality + 0.2 * backlog;
    const managerRating = clamp(
      Math.round(1 + 4 * clamp((score - 0.35) / 0.6, 0, 1) + randomBetween(-0.3, 0.3)),
      1,
      5
    );
    const selfRating = review.selfRating ?? clamp(managerRating + (chance(0.45) ? 1 : 0), 1, 5);
    const finalizedAt = at(day, randomInt(hm("16:00"), hm("17:00")));

    await tx.performanceReview.update({
      where: { id: review.id },
      data: {
        reviewerUserId: employee.managerUserId ?? ctx.adminUserId,
        selfRating,
        selfComment: review.selfComment ?? SELF_COMMENTS[selfRating],
        managerRating,
        managerComment:
          `${REVIEW_COMMENTS[managerRating]} Trong kỳ hoàn thành ${metrics.done} đầu việc ` +
          `(${metrics.onTime} đúng hạn), còn ${metrics.overdueOpen} việc quá hạn; ` +
          `đi muộn ${metrics.late}/${metrics.checkIns} buổi.`,
        finalRating: managerRating,
        status: PerformanceReviewStatus.FINALIZED,
        submittedAt: review.submittedAt ?? at(day, randomInt(hm("08:30"), hm("10:00"))),
        reviewedAt: at(day, randomInt(hm("13:30"), hm("15:30"))),
        finalizedAt
      }
    });
    await notify(tx, ctx, employee.userId, {
      type: NotificationType.REVIEW_FINALIZED,
      title: "Performance review finalized",
      message: `Your performance review for "${cycle.name}" has been finalized.`,
      entityType: "PerformanceReview",
      entityId: review.id,
      createdAt: finalizedAt
    });
    totals.reviewsFinalized += 1;
  }

  await tx.reviewCycle.update({ where: { id: cycle.id }, data: { status: ReviewCycleStatus.CLOSED } });
  totals.cyclesClosed.push(cycle.name);
}

async function cycleMetrics(tx: Tx, employeeId: number, cycle: { startDate: Date; endDate: Date }) {
  const done = await tx.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: employeeId,
      status: DONE,
      completedAt: { gte: at(cycle.startDate, 0), lt: at(addDays(cycle.endDate, 1), 0) }
    },
    select: { dueDate: true, completedAt: true, estimatedHours: true, actualHours: true }
  });
  const overdueOpen = await tx.task.count({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: employeeId,
      status: { in: OPEN_TASK_STATUSES },
      dueDate: { lt: cycle.endDate }
    }
  });
  const checkIns = await tx.attendanceRecord.findMany({
    where: {
      employeeId,
      recordType: AttendanceRecordType.CHECK_IN,
      isAdjustment: false,
      workDate: { gte: cycle.startDate, lte: cycle.endDate }
    },
    select: { attendanceStatus: true }
  });

  const estimated = done.reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0);
  const actual = done.reduce((sum, task) => sum + Number(task.actualHours ?? 0), 0);
  const late = checkIns.filter((record) => record.attendanceStatus === AttendanceStatus.LATE).length;
  return {
    done: done.length,
    onTime: done.filter((task) => !task.dueDate || companyToday(task.completedAt!) <= task.dueDate).length,
    efficiency: actual > 0 ? Math.min(1, estimated / actual) : 1,
    overdueOpen,
    late,
    checkIns: checkIns.length,
    lateRate: checkIns.length ? late / checkIns.length : 0
  };
}

// --- Shared helpers ---------------------------------------------------------------

async function openHoursByEmployee(tx: Tx) {
  const tasks = await tx.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      assigneeId: { not: null },
      status: { in: OPEN_TASK_STATUSES }
    },
    select: { assigneeId: true, estimatedHours: true, actualHours: true }
  });
  const loads = new Map<number, number>();
  for (const task of tasks) {
    const remaining = Math.max(1, Number(task.estimatedHours ?? 4) - Number(task.actualHours ?? 0));
    loads.set(task.assigneeId!, (loads.get(task.assigneeId!) ?? 0) + remaining);
  }
  return loads;
}

/** Remaining hours of open subtasks per team, assigned or not. */
async function openHoursByTeam(tx: Tx) {
  const tasks = await tx.task.findMany({
    where: {
      deletedAt: null,
      parentTaskId: { not: null },
      teamId: { not: null },
      status: { in: OPEN_TASK_STATUSES }
    },
    select: { teamId: true, estimatedHours: true, actualHours: true }
  });
  const backlog = new Map<number, number>();
  for (const task of tasks) {
    const remaining = Math.max(1, Number(task.estimatedHours ?? 4) - Number(task.actualHours ?? 0));
    backlog.set(task.teamId!, (backlog.get(task.teamId!) ?? 0) + remaining);
  }
  return backlog;
}

function activeMembers(ctx: Context, team: SimTeam) {
  return team.memberIds
    .map((id) => ctx.employees.get(id))
    .filter((employee): employee is SimEmployee => Boolean(employee));
}

function leadUserOf(ctx: Context, team: SimTeam) {
  const lead = team.leadId ? ctx.employees.get(team.leadId) : undefined;
  const department = ctx.departments.get(team.departmentId);
  const head = department?.headId ? ctx.employees.get(department.headId) : undefined;
  return lead?.userId ?? head?.userId ?? ctx.adminUserId;
}

async function notify(
  tx: Tx,
  ctx: Context,
  userId: number | null,
  data: {
    type: NotificationType;
    title: string;
    message: string;
    entityType: string;
    entityId: number;
    createdAt: Date;
  }
) {
  if (!userId) {
    return;
  }
  await tx.notification.create({ data: { userId, ...data, isRead: data.createdAt < ctx.readBefore } });
}

function highestPriority(priorities: TaskPriority[]) {
  return priorities.reduce((best, item) => (PRIORITY_RANK[item] > PRIORITY_RANK[best] ? item : best), TaskPriority.LOW);
}

function latest(dates: Date[]) {
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hash01(value: string) {
  return createRandom(hashString(value))();
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function isWorkday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
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
  console.info(`\nĐã mô phỏng ${totals.days.length} ngày làm việc: ${totals.days.join(", ")}`);
  console.info(`- Dự án mới: ${totals.projects.length ? "" : "—"}`);
  for (const project of totals.projects) {
    console.info(`    • ${project}`);
  }
  console.info(`- Dự án bắt đầu: ${list(totals.projectsStarted)}; hoàn thành: ${list(totals.projectsCompleted)}`);
  console.info(
    `- Task: ${totals.newTasks} task mới, ${totals.assignments} lượt giao, ${totals.reassignments} lượt chuyển giao, ` +
      `${totals.started} bắt đầu làm, ${totals.submitted} gửi duyệt, ${totals.completed} hoàn thành ` +
      `(${totals.completedLate} trễ hạn), ${totals.reworks} bị trả về sửa, ${totals.cancelled} bị hủy`
  );
  console.info(
    `- Chấm công: ${totals.attendanceRecords} bản ghi, ${totals.lateCheckIns} lượt đi muộn, ` +
      `${totals.absences} lượt vắng không phép`
  );
  console.info(
    `- Nghỉ phép: ${totals.sickLeaves} nghỉ ốm, ${totals.leaveFiled} đơn mới chờ duyệt, ` +
      `${totals.leaveApproved} duyệt, ${totals.leaveRejected} từ chối, ${totals.leaveCancelled} hủy`
  );
  if (totals.selfReviews || totals.reviewsFinalized || totals.cyclesOpened.length) {
    console.info(
      `- Đánh giá: ${totals.selfReviews} tự đánh giá, ${totals.reviewsFinalized} phiếu chốt; ` +
        `mở kỳ: ${list(totals.cyclesOpened)}; đóng kỳ: ${list(totals.cyclesClosed)}`
    );
  }
}

async function printPerformers(ctx: Context, through: Date) {
  const employeeIds = [...ctx.employees.keys()];
  const [done, checkIns] = await Promise.all([
    prisma.task.findMany({
      where: { deletedAt: null, parentTaskId: { not: null }, status: DONE, assigneeId: { in: employeeIds } },
      select: { assigneeId: true, dueDate: true, completedAt: true, estimatedHours: true, actualHours: true }
    }),
    prisma.attendanceRecord.groupBy({
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
