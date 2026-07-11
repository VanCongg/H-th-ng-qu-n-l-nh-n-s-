# Tổng hợp những gì hệ thống OmniHR đã làm được

Ngày tổng hợp: 28/06/2026  
Phạm vi rà soát: `OmniHR_BE`, `OmniHR_WEB`, `OmniHR_APP`  
Mục tiêu: liệt kê các phần hệ thống đã triển khai để dùng cho báo cáo, bàn giao hoặc bảo vệ đồ án.

## 1. Tổng quan hệ thống

OmniHR hiện là một hệ thống quản lý nhân sự fullstack gồm ba phần chính:

- `OmniHR_BE`: backend NestJS, Prisma, PostgreSQL, JWT, RBAC/ABAC, Swagger, Docker.
- `OmniHR_WEB`: web React, TypeScript, Vite, Mantine UI cho Admin và Manager.
- `OmniHR_APP`: mobile app Flutter cho nhân viên, tập trung vào đăng nhập, dashboard, chấm công, nghỉ phép và hồ sơ cá nhân.

Hệ thống đã vượt khỏi phạm vi Core HR cơ bản. Ngoài quản lý nhân sự, phòng ban, chức danh và phân quyền, hệ thống đã có thêm các phần Phase 2 như project, task, skill, workload và AI gợi ý chia task.

## 2. Backend đã làm được

### 2.1 Nền tảng backend

- Dựng backend bằng NestJS 11 và TypeScript.
- Kết nối PostgreSQL qua Prisma.
- Cấu hình Docker và Docker Compose cho backend/database.
- Cấu hình Swagger/OpenAPI ở `/docs` khi không chạy production.
- Cấu hình Helmet, CORS, validation pipe, sanitize input và rate limit.
- Chuẩn hóa response API theo envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

- Chuẩn hóa lỗi qua `ApiError` và `HttpExceptionFilter`.
- Có interceptor để wrap response, tránh frontend/mobile phải xử lý nhiều dạng payload khác nhau.

### 2.2 Xác thực và bảo mật

- Đăng nhập bằng username hoặc email.
- JWT access token và refresh token.
- Refresh token được hash trong database.
- Có refresh token rotation.
- Có cơ chế phát hiện reuse refresh token.
- Logout xóa refresh token hash và tăng version.
- API `/auth/me` trả lại user, role, permission và employee id.
- Đổi mật khẩu qua `/auth/change-password`.
- Có global guards:
  - `JwtAuthGuard`
  - `RolesGuard`
  - `PermissionsGuard`
  - `ThrottlerGuard`

### 2.3 RBAC và ABAC

- Có bảng role, permission, user role, role permission.
- Role hệ thống chính: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Controller dùng decorator `@Permissions(...)` để kiểm soát quyền.
- Có `AccessControlService` để xử lý phạm vi dữ liệu theo vai trò:
  - Admin xem/quản lý toàn hệ thống.
  - Manager thao tác trong phạm vi team, cấp dưới, phòng ban hoặc project liên quan.
  - Employee chủ yếu xem và thao tác dữ liệu của chính mình.
- Có rule chống manager duyệt đơn nghỉ của chính mình.
- Có rule kiểm tra manager/team scope khi assign task, xem project, xem employee và tạo AI suggestion.

### 2.4 Quản lý người dùng

- API quản lý user:
  - `GET /users`
  - `GET /users/:id`
  - `POST /users`
  - `PATCH /users/:id`
  - `DELETE /users/:id`
  - `POST /users/:id/roles`
  - `DELETE /users/:id/roles/:roleId`
  - `POST /users/:id/reset-password`
- Có list user phân trang.
- Có tạo/sửa/xóa mềm user.
- Có gán/gỡ role.
- Có reset password.
- Có kiểm tra trùng username/email.
- Có liên kết user với employee profile.

### 2.5 Quản lý nhân viên

- API quản lý employee:
  - `GET /employees`
  - `GET /employees/team`
  - `GET /employees/me`
  - `PATCH /employees/me`
  - `GET /employees/:id`
  - `POST /employees`
  - `PATCH /employees/:id`
  - `DELETE /employees/:id`
  - `POST /employees/:id/reset-password`
  - `POST /employees/:id/lock-user`
  - `POST /employees/:id/unlock-user`
- Admin quản lý toàn bộ nhân viên.
- Manager xem nhân viên trong team/phạm vi quản lý.
- Employee xem và cập nhật một phần hồ sơ cá nhân.
- Tạo employee kèm user account.
- Khóa/mở khóa tài khoản user của employee.
- Có employee code, email công ty, avatar, phòng ban, chức danh, career level và trạng thái nhân viên.

### 2.6 Phòng ban, chức danh, manager và team

- Quản lý phòng ban:
  - CRUD phòng ban.
  - Cây phòng ban cha/con.
  - Gán trưởng phòng.
  - Kiểm tra vòng lặp parent.
  - Xóa mềm.
- Quản lý chức danh:
  - CRUD chức danh.
  - Gắn chức danh với phòng ban.
  - Gắn skill theo chức danh qua `PositionSkill`.
- Quản lý quan hệ manager:
  - Gán direct/project manager.
  - Kết thúc quan hệ quản lý.
  - Không cho manager là chính employee.
  - Kiểm tra trùng quan hệ active.
  - Kiểm tra vòng lặp quản lý.
- Quản lý team:
  - CRUD team.
  - Team thuộc department.
  - Có lead và member.
  - Có lịch sử joined/left.
  - Có rule đồng bộ lead membership.
  - Kiểm tra thành viên cùng department.

### 2.7 Chấm công

- API chấm công:
  - `POST /attendance/check-in`
  - `POST /attendance/check-out`
  - `GET /attendance`
  - `GET /attendance/self`
  - `GET /attendance/team`
  - `GET /attendance/employee/:employeeId`
  - `POST /attendance/admin`
  - `PATCH /attendance/:id`
- Lưu bản ghi chấm công theo employee, ngày làm việc, loại record, thời điểm ghi nhận, ca làm và trạng thái.
- Hỗ trợ ca sáng/chiều.
- Tính trạng thái:
  - `ON_TIME`
  - `LATE`
  - `EARLY_OUT`
  - `MANUAL_ADJUSTMENT`
- Lưu tọa độ latitude/longitude, địa chỉ, khoảng cách tới công ty và nguồn ghi nhận.
- Có kiểm tra vị trí theo cấu hình công ty.
- Có cấu hình bán kính chấm công.
- Có check-in/check-out từ mobile hoặc web.
- Admin có thể tạo bản ghi điều chỉnh.
- Có audit log cho hoạt động chấm công.

### 2.8 Nghỉ phép

- Quản lý loại nghỉ phép:
  - `GET /leave-types`
  - `GET /leave-types/:id`
  - `POST /leave-types`
  - `PATCH /leave-types/:id`
  - `DELETE /leave-types/:id`
- Quản lý đơn nghỉ:
  - `POST /leave-requests`
  - `GET /leave-requests`
  - `GET /leave-requests/self`
  - `GET /leave-requests/team`
  - `GET /leave-requests/:id`
  - `POST /leave-requests/:id/approve`
  - `POST /leave-requests/:id/reject`
  - `POST /leave-requests/:id/cancel`
- Tính số ngày nghỉ loại trừ cuối tuần.
- Employee tạo/cancel đơn của mình.
- Manager/Admin duyệt hoặc từ chối đơn trong phạm vi quyền.
- Đơn nghỉ được dùng làm dữ liệu availability cho AI gợi ý chia task.

### 2.9 Project, task và workload

- Quản lý project:
  - `GET /projects`
  - `GET /projects/:id`
  - `POST /projects`
  - `PATCH /projects/:id`
  - `DELETE /projects/:id`
- Project gắn với department và manager.
- Project có trạng thái, ngày bắt đầu, ngày kết thúc và xóa mềm.
- Quản lý task:
  - `GET /tasks`
  - `GET /tasks/team`
  - `GET /tasks/me`
  - `GET /tasks/:id`
  - `POST /tasks`
  - `PATCH /tasks/:id`
  - `DELETE /tasks/:id`
  - `POST /tasks/:id/assign`
  - `PATCH /tasks/:id/status`
- Task có priority, status, assignee, start date, due date, estimated hours và actual hours.
- Đã có task cha/con:
  - Team-level task là task tổng.
  - Subtask dùng để chia việc cụ thể cho nhân viên.
  - Subtask phải nằm trong project/team của task cha.
  - Ngày của subtask không được vượt ngoài ngày của task cha.
  - Trạng thái task cha được tính từ subtasks.
- Task tổng có danh sách công nghệ (`technologies`).
- Required skills được khai báo ở subtask.
- Có lịch sử giao task trong `task_assignments`.
- Khi đổi assignee có ghi lịch sử assignment/reassignment.
- Có module `task-workload` để tính tải việc theo nhân viên:
  - Số task active.
  - Tổng estimated hours.
  - Số task quá hạn.
  - Giờ khả dụng trong tuần.
  - Workload score.

### 2.10 Skill và thiết kế kỹ năng cho AI

- Quản lý danh mục skill:
  - `GET /skills`
  - `GET /skills/:id`
  - `POST /skills`
  - `PATCH /skills/:id`
  - `DELETE /skills/:id`
- Gán skill cho nhân viên:
  - `GET /employees/:employeeId/skills`
  - `POST /employees/:employeeId/skills`
  - `PATCH /employee-skills/:id`
  - `DELETE /employee-skills/:id`
- Employee skill lưu:
  - Skill.
  - Mức thành thạo.
  - Số năm kinh nghiệm.
  - Lần dùng gần nhất.
  - Ghi chú.
- Task required skill đã chuyển sang thiết kế dễ dùng hơn:
  - `requiredProficiency`
  - `importance`
- Có enum `TaskSkillImportance`:
  - `REQUIRED`
  - `IMPORTANT`
  - `NICE_TO_HAVE`
- Backend không bắt người dùng nhập weight số học trực tiếp cho task skill.

### 2.11 AI gợi ý chia task

- Module AI hiện là rule-based recommendation, không phải ML/LLM.
- Algorithm hiện tại: `rule-based-v3`.
- API AI:
  - `POST /tasks/:taskId/ai-suggestions`
  - `GET /tasks/:taskId/ai-suggestions`
  - `GET /ai-task-suggestions`
  - `GET /ai-task-suggestions/:id`
  - `POST /ai-task-suggestions/:id/select`
  - `POST /ai-task-suggestions/:id/cancel`
- Khi generate suggestion, backend:
  - Lấy task và required skills.
  - Lấy candidate theo RBAC/ABAC.
  - Lọc người ngoài team nếu task thuộc team.
  - Có option loại chính requester khỏi candidate qua `includeSelf`.
  - Tính `skillScore` theo mức thành thạo, kinh nghiệm và tầm quan trọng của skill.
  - Tính `workloadScore` theo task active, estimated hours và task quá hạn.
  - Tính `availabilityScore` theo đơn nghỉ đã duyệt và đơn nghỉ chờ duyệt.
  - Tính availability theo số ngày làm việc overlap, không chỉ theo kiểu có/không.
  - Tạo reason giải thích vì sao nhân viên được gợi ý.
  - Lưu snapshot input và kết quả vào database.
- Công thức điểm:
  - Có availability: skill 50%, workload 35%, availability 15%.
  - Không availability: skill 60%, workload 40%.
- Có `taskFingerprint` trong snapshot để chống chọn suggestion cũ sau khi task thay đổi.
- Có TTL suggestion và logic expire khi suggestion quá hạn hoặc task đã thay đổi.
- Có API cancel suggestion và ghi audit `CANCEL_AI_TASK_SUGGESTION`.
- AI chỉ gợi ý, không tự động quyết định. Manager/Admin vẫn là người chọn cuối cùng.
- Khi select suggestion:
  - Kiểm tra suggestion còn hợp lệ.
  - Kiểm tra item thuộc suggestion.
  - Kiểm tra quyền assign.
  - Kiểm tra assignee thuộc team của task.
  - Cập nhật assignee cho task.
  - Ghi `task_assignments`.
  - Ghi audit log.

### 2.12 Dashboard, system settings và audit log

- Có dashboard cho Admin: `/admin/dashboard`.
- Có dashboard cho Manager: `/app/dashboard`.
- Có API system settings:
  - `GET /system-settings`
  - `PATCH /system-settings`
- Cấu hình hệ thống đã có:
  - Tên công ty.
  - Địa chỉ công ty.
  - Tọa độ công ty.
  - Bán kính chấm công.
  - Khung giờ check-in sớm.
  - Giờ ca sáng/chiều.
  - Timezone offset.
  - Bật/tắt bắt buộc vị trí chấm công.
- Có audit log:
  - `GET /audit-logs`
  - Lưu user, action, entity, old value, new value, ip, user agent và thời điểm.

### 2.13 Database, migration và seed

- Prisma schema đã có đủ các nhóm dữ liệu:
  - User, Role, Permission.
  - Department, Position, Employee.
  - EmployeeManager, Team, TeamMember.
  - AttendanceRecord, SystemSetting.
  - LeaveType, LeaveRequest.
  - Project, Task, TaskRequiredSkill, TaskAssignment.
  - Skill, PositionSkill, EmployeeSkill.
  - AiTaskSuggestion, AiTaskSuggestionItem.
  - AuditLog.
- Đã có nhiều migration theo từng giai đoạn:
  - Init CoreHR.
  - Phase 2 task/AI assignment.
  - Attendance settings/location.
  - Position skill mapping.
  - Career level.
  - Team structure.
  - Department manager.
  - Employee avatar.
  - Team member history.
  - Project department/task hierarchy.
  - Task technologies.
  - Skill importance v3.
- Seed data đã có:
  - Role và permission.
  - User/employee mẫu.
  - Department/position mẫu.
  - Leave type.
  - Skill catalog.
  - Employee skills.
  - Project/task mẫu.
  - Required skills cho task.
  - Attendance/leave mẫu.
  - AI suggestion mẫu.

### 2.14 Test backend

- Đã có unit test cho:
  - Auth refresh token.
  - Common utils.
  - Sanitize input pipe.
  - Response interceptor.
  - Project date validation.
  - Task assignment history và date validation.
  - AI task suggestion:
    - Không chọn người ngoài team.
    - Không generate người ngoài team.
    - Availability theo ngày làm việc và pending leave.
    - Expire suggestion khi fingerprint thay đổi.
    - Cancel suggestion và lưu reason trong snapshot.

## 3. Web đã làm được

### 3.1 Nền tảng web

- Dựng web bằng React, TypeScript và Vite.
- Dùng Mantine UI.
- Dùng React Router cho route.
- Dùng TanStack Query cho API state.
- Dùng Axios cho HTTP client.
- Dùng Zustand cho auth/preferences store.
- Có i18n cơ bản và translate enum nghiệp vụ.
- Có layout riêng cho Admin và Manager.
- Có guard đăng nhập và guard role.
- Có component dùng lại:
  - DataTable.
  - PageHeader.
  - ConfirmModal.
  - EmptyState.
  - PermissionGate.
  - EmployeeAvatar.
  - EmployeeAvatarUpload.

### 3.2 Login và auth web

- Có trang đăng nhập.
- Lưu auth state.
- Gọi `/auth/me` để hydrate user.
- Có trang forbidden.
- Có notice cho employee web nếu cần điều hướng sang mobile.
- API client tự unwrap response envelope.

### 3.3 Admin web

Admin route hiện có:

- `/admin/dashboard`
- `/admin/users`
- `/admin/departments`
- `/admin/positions`
- `/admin/leave-types`
- `/admin/skills`
- `/admin/roles-permissions`
- `/admin/policies`
- `/admin/audit-logs`
- `/admin/system-settings`

Admin đã có màn:

- Dashboard.
- Quản lý users.
- Quản lý departments.
- Quản lý positions.
- Quản lý leave types.
- Quản lý skills.
- Quản lý roles và permissions.
- Xem audit logs.
- Trang policies dạng nội dung/tài liệu.
- System settings để cấu hình chấm công và thông tin công ty.

### 3.4 Manager web

Manager route hiện có:

- `/app/dashboard`
- `/app/teams`
- `/app/team`
- `/app/employee-skills`
- `/app/team-attendance`
- `/app/team-leave-requests`
- `/app/projects`
- `/app/team-tasks`
- `/app/ai-task-suggestions`
- `/app/profile`

Manager đã có màn:

- Dashboard.
- My Team.
- Teams.
- Employee Skills.
- Team Attendance.
- Team Leave Requests.
- Projects.
- Team Tasks.
- AI Task Suggestions.
- My Profile.

### 3.5 Các màn nghiệp vụ web đã có file

- Login.
- Admin Dashboard.
- Manager Dashboard.
- Employees/User management.
- Departments.
- Positions.
- Teams.
- Managers.
- Attendance.
- Leave Requests.
- Leave Types.
- Projects.
- Tasks.
- Skills.
- Employee Skills.
- AI Task Suggestions.
- Roles & Permissions.
- Policies.
- Audit Logs.
- System Settings.
- My Profile.

### 3.6 Web task và AI suggestion

- Web task page đã hỗ trợ:
  - Danh sách task.
  - Task cha/con.
  - Tạo subtask từ task tổng.
  - Hiển thị công nghệ của task tổng.
  - Khai báo required skills cho subtask.
  - Dùng `importance` thay vì weight/isRequired.
  - Gán task.
  - Cập nhật trạng thái.
  - Xem chi tiết task.
- Web AI suggestion page đã hỗ trợ:
  - Chọn task để generate suggestion.
  - Chọn số lượng candidate.
  - Bật/tắt include leave availability.
  - Xem danh sách suggestion.
  - Lọc theo trạng thái và task.
  - Xem detail candidate, điểm skill/workload/availability và reason.
  - Chọn candidate để assign task.

### 3.7 API client web

`src/api/endpoints.ts` đã wrap hầu hết API backend:

- Auth.
- Dashboard/settings.
- Employees.
- Departments.
- Teams.
- Projects.
- Skills.
- Employee skills.
- Tasks.
- Task assignments.
- Task workload.
- AI task suggestions.
- Positions.
- Managers.
- Attendance.
- Leave types.
- Leave requests.
- Users.
- Roles.
- Permissions.
- Audit logs.

`src/api/types.ts` đã có type cho các entity chính, bao gồm task hierarchy, technologies, task skill importance và AI suggestion.

## 4. Mobile app đã làm được

### 4.1 Nền tảng mobile

- Dựng mobile app bằng Flutter.
- Có Material 3 theme.
- Có brand color, app background, card/input/button style.
- Có app shell và bootstrap session.
- Có assets ảnh login.
- Có cấu trúc module:
  - auth.
  - shell.
  - dashboard.
  - attendance.
  - leave.
  - tasks.
  - profile.

### 4.2 Session và API mobile

- Lưu API base URL.
- Lưu access token và refresh token.
- Lưu user session bằng SharedPreferences.
- Login bằng username/email/password.
- Gọi `/auth/me`.
- Load `/employees/me`.
- Tự refresh token khi API trả 401.
- Logout cả API và local session.
- `ApiService` hỗ trợ GET/POST/PATCH/DELETE.
- Unwrap response envelope giống web.
- Parse lỗi backend để hiển thị cho người dùng.

### 4.3 Dashboard mobile

- Hiển thị greeting và thông tin employee.
- Load profile nhân viên.
- Load lịch sử chấm công gần nhất nếu có quyền.
- Xác định hành động tiếp theo là check-in hay check-out.
- Có nút chấm công lớn trên dashboard.
- Có confirm dialog trước khi check-in/check-out.
- Gọi API:
  - `/attendance/check-in`
  - `/attendance/check-out`
- Refresh dữ liệu sau khi ghi nhận.

### 4.4 GPS và chấm công mobile

- Có helper lấy vị trí qua `geolocator`.
- Kiểm tra location service.
- Xin quyền location nếu chưa có.
- Xử lý denied và denied forever.
- Lấy vị trí với accuracy high và timeout.
- Android manifest đã có:
  - `INTERNET`
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_COARSE_LOCATION`
  - `usesCleartextTraffic="true"`
- Có `AttendanceScreen` riêng:
  - Load `/attendance/self`.
  - Pull refresh.
  - Check-in/check-out với GPS.
  - Hiển thị số record hôm nay.
  - Hiển thị history.
  - Có loading/error/empty states.

### 4.5 Nghỉ phép mobile

- Có `LeaveScreen`:
  - Load `/leave-types`.
  - Load `/leave-requests/self`.
  - Tạo đơn nghỉ bằng bottom sheet.
  - Chọn loại nghỉ.
  - Chọn ngày bắt đầu/kết thúc.
  - Nhập lý do.
  - Gọi `/leave-requests`.
  - Cancel đơn pending.
  - Hiển thị thống kê pending/approved/total.

### 4.6 Profile mobile

- Hiển thị avatar chữ cái đầu.
- Hiển thị employee code, department, position.
- Có bottom sheet hồ sơ.
- Có bottom sheet chính sách dạng placeholder.
- Có bottom sheet cài đặt.
- Có đổi mật khẩu qua `/auth/change-password`.
- Có đăng xuất.

### 4.7 HRGenie placeholder

- Home shell có floating action button HRGenie.
- Có bottom sheet giới thiệu trợ lý nhân sự.
- Hiện tại là placeholder, chưa kết nối chatbot thật.

## 5. Những điểm cần chú ý khi trình bày

Các phần dưới đây không phủ nhận hệ thống đã làm được, nhưng cần nói rõ để tránh hiểu nhầm phạm vi:

- AI gợi ý chia task là rule-based recommendation, chưa phải machine learning hoặc LLM.
- Web Admin hiện chưa expose route/menu cho toàn bộ các màn Phase 2 như attendance, leave requests, projects, tasks, employee skills và AI suggestions, dù file page/API client đã có.
- Manager web đã expose các màn Phase 2 chính.
- Web AI suggestion hiện mới gửi `limit` và `includeAvailability`; backend đã hỗ trợ thêm `includeSelf` và `includePendingLeave`.
- Mobile `HomeShell` hiện chỉ mount 3 tab: Home, Task, Profile.
- Mobile đã có file `AttendanceScreen` và `LeaveScreen`, nhưng chưa được đưa vào bottom navigation hiện tại.
- Mobile `TasksScreen` hiện nghiêng về tạo đơn nghỉ thủ công, chưa phải task list cá nhân đúng nghĩa.
- Backend schema có model `Policy`, nhưng web `PoliciesPage` hiện là trang nội dung chính sách, chưa phải CRUD policy động đầy đủ.
- Cần cấu hình tọa độ công ty và bán kính trong System Settings trước khi demo chấm công GPS nếu bật bắt buộc vị trí.

## 6. Kết luận ngắn

Tính đến thời điểm tổng hợp, OmniHR đã có nền tảng quản lý nhân sự khá đầy đủ: xác thực, phân quyền, nhân viên, phòng ban, chức danh, team, chấm công, nghỉ phép, audit log, cấu hình hệ thống, project/task, skill, workload và AI gợi ý chia task.

Điểm nổi bật nhất của hệ thống là đã có luồng quản lý task theo team/subtask và AI rule-based v3 có giải thích, có kiểm soát quyền, có tính workload/availability, có fingerprint chống chọn gợi ý cũ, có cancel/expire và có audit log. Đây là phần đủ tốt để trình bày như một module hỗ trợ quản lý phân công công việc minh bạch trong hệ thống HR nội bộ.
