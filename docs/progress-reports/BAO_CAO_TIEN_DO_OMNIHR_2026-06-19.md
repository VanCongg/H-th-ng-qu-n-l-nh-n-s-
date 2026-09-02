# Báo cáo tiến độ OmniHR trước khi tiếp tục phần chấm công

Ngày xuất: 19/06/2026  
Workspace: `D:\OmniHR`  
Branch hiện tại: `phase2`  
Mục đích: ghi lại thật chi tiết những phần đã làm trong project OmniHR để có mốc rõ ràng trước khi tiếp tục hoàn thiện module chấm công.

## 1. Tóm tắt nhanh

OmniHR hiện là một project fullstack quản lý nhân sự gồm 3 phần chính:

- `OmniHR_BE`: backend NestJS, Prisma, PostgreSQL, JWT, RBAC, ABAC, Docker.
- `OmniHR_WEB`: web React, TypeScript, Vite, Mantine UI cho Admin và Manager.
- `OmniHR_APP`: app Flutter cho nhân viên, đang tập trung vào đăng nhập, dashboard, check-in/check-out, tạo đơn nghỉ và hồ sơ cá nhân.

Project không còn chỉ ở Phase 1. Backend và web đã mở rộng khá nhiều sang Phase 2:

- Quản lý project.
- Quản lý task.
- Quản lý skill.
- Gán skill cho nhân viên.
- Giao task thủ công.
- Gợi ý giao task bằng rule-based AI.
- Tính workload cơ bản.

Phần chấm công đã có nền backend tương đối đầy đủ: API check-in/check-out, lưu vị trí, chia ca sáng/chiều, trạng thái đúng giờ/trễ/về sớm, cấu hình tọa độ công ty, bán kính chấm công, admin tạo bản ghi điều chỉnh và audit log. Mobile app cũng đã có nút chấm công trên dashboard, lấy GPS qua `geolocator`. Tuy nhiên màn `AttendanceScreen` riêng chưa được đưa vào bottom navigation hiện tại, nên cần quyết định tiếp là giữ chấm công ở Home hay tách thành tab riêng.

## 2. Trạng thái Git và mốc hiện tại

Lịch sử commit gần nhất:

- `6318c17c` trên branch `phase2`: mốc ngày 17/6.
- `1268cfcb` trên branch `develop`: phase1.
- `0fd369ed` trên branch `main`: first commit.

Working tree hiện có nhiều file đã chỉnh sửa và một số file mới chưa commit, gồm:

- Nhiều file Flutter app trong `OmniHR_APP/lib`, `pubspec.yaml`, Android manifest và assets.
- Một số file backend trong `src`, `prisma/schema.prisma`, `prisma/seed.ts`, migrations mới.
- Một số file web trong `src/features`, `src/api/types.ts`, `src/i18n.ts`.
- Có thay đổi trong `dist` và `node_modules/.prisma` của backend do build/generate.

Vì vậy báo cáo này là snapshot theo source hiện tại, không phải release note đã đóng gói.

## 3. Cấu trúc repository

Repo gốc:

```txt
D:\OmniHR
  README.md
  OmniHR_BE
  OmniHR_WEB
  OmniHR_APP
```

### 3.1 Backend

Backend có khoảng 148 file TypeScript trong `OmniHR_BE/src`.

Các module chính:

```txt
ai-task-suggestions
attendance
audit-logs
auth
common
dashboard
departments
employee-managers
employee-skills
employees
leave-requests
leave-types
permissions
policies
positions
prisma
projects
roles
skills
task-assignments
task-workload
tasks
teams
users
```

Lưu ý: thư mục `src/policies` hiện chỉ có `dto`; backend chưa có `PoliciesModule` được import trong `AppModule`. Web `PoliciesPage` hiện là trang tài liệu chính sách tĩnh, không phải màn CRUD policy động.

### 3.2 Web

Web có khoảng 57 file TypeScript/TSX trong `OmniHR_WEB/src`.

Các nhóm chính:

```txt
api
app
components
features
layouts
store
styles
```

Các feature web đã có file:

```txt
admin-dashboard
ai-task-suggestions
app-dashboard
attendance
audit-logs
auth
departments
employee-skills
employees
leave-requests
leave-types
managers
policies
positions
projects
roles-permissions
skills
system-settings
tasks
teams
users
```

### 3.3 Mobile app

Mobile app có khoảng 15 file Dart trong `OmniHR_APP/lib`.

Cấu trúc chính:

```txt
lib
  app.dart
  main.dart
  core
    api_service.dart
    attendance_location.dart
    session.dart
    utils.dart
  models
    omni_models.dart
  modules
    auth
    shell
    dashboard
    attendance
    leave
    tasks
    profile
  shared
    widgets
      common.dart
```

Assets hiện có:

```txt
assets/images/login-office-1.jpg
assets/images/login-office-2.jpg
assets/images/login-office-3.jpg
```

## 4. Công nghệ sử dụng

### 4.1 Backend

- NestJS 11.
- TypeScript.
- Prisma 5.
- PostgreSQL.
- JWT access token và refresh token.
- bcrypt.
- class-validator, class-transformer.
- Swagger/OpenAPI.
- Helmet.
- Nest Throttler.
- Joi validate environment.
- Docker và Docker Compose.

Scripts backend:

```txt
npm run build
npm run start:dev
npm run start:prod
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run prisma:validate
```

### 4.2 Web

- React 19.
- TypeScript.
- Vite 7.
- Mantine UI 8.
- React Router 7.
- TanStack Query 5.
- Axios.
- Zustand.
- Mantine Notifications.
- lucide-react icons.

Scripts web:

```txt
npm run dev
npm run build
npm run preview
npm run lint
```

### 4.3 Mobile

- Flutter SDK.
- Material 3.
- `http` cho gọi API.
- `shared_preferences` cho lưu session.
- `intl` cho format.
- `geolocator` cho lấy vị trí chấm công.

Scripts/check mobile được ghi trong README:

```txt
flutter pub get
flutter run -d chrome
flutter run
flutter build apk --debug
flutter build apk --release
dart format lib test
flutter analyze
flutter test
```

## 5. Backend đã làm

### 5.1 Cấu hình app backend

`AppModule` đã gom các module nghiệp vụ chính:

- Auth.
- Dashboard.
- Users.
- Roles.
- Permissions.
- Departments.
- Positions.
- Employees.
- Employee Managers.
- Attendance.
- Leave Types.
- Leave Requests.
- Audit Logs.
- Projects.
- Skills.
- Employee Skills.
- Teams.
- Tasks.
- Task Assignments.
- Task Workload.
- AI Task Suggestions.

Các guard/interceptor/filter toàn cục đã có:

- `HttpExceptionFilter`: chuẩn hóa lỗi.
- `ResponseInterceptor`: wrap response theo envelope.
- `ThrottlerGuard`: rate limit.
- `JwtAuthGuard`: xác thực JWT.
- `RolesGuard`: kiểm tra role.
- `PermissionsGuard`: kiểm tra permission.

`main.ts` đã cấu hình:

- Helmet.
- CORS theo `CORS_ORIGIN`.
- Global sanitize pipe.
- Global validation pipe với whitelist, forbid non-whitelisted, transform.
- Swagger ở `/docs` khi không chạy production.
- Port mặc định 3000.

### 5.2 Format response API

Backend đang dùng envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Khi lỗi:

```json
{
  "success": false,
  "message": "Error message",
  "errorCode": "ERROR_CODE"
}
```

Điểm tốt:

- Frontend web và mobile đều unwrap `data`.
- Error code đã được service ném qua `ApiError`.
- Frontend có hàm lấy message lỗi và dịch sang tiếng Việt ở web.

### 5.3 Database và Prisma schema

Schema hiện đã vượt Phase 1, gồm HR core, attendance, leave, team, project, task, skill và AI suggestion.

Enums đã có:

- `EmployeeStatus`: `ACTIVE`, `INACTIVE`, `TERMINATED`.
- `CareerLevel`: `INTERN`, `FRESHER`, `JUNIOR`, `MIDDLE`, `SENIOR`, `LEAD`.
- `ManagerType`: `DIRECT`, `PROJECT`.
- `AttendanceRecordType`: `CHECK_IN`, `CHECK_OUT`, `ADJUSTMENT`.
- `AttendanceShift`: `MORNING`, `AFTERNOON`.
- `AttendanceStatus`: `ON_TIME`, `LATE`, `EARLY_OUT`, `MANUAL_ADJUSTMENT`.
- `LeaveRequestStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
- `ProjectStatus`: `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`.
- `TaskPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- `TaskStatus`: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`.
- `SkillProficiency`: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`.
- `TeamMemberRole`: `LEAD`, `MEMBER`.
- `TaskAssignmentType`: `MANUAL`, `AI_SUGGESTED`, `REASSIGNED`.
- `AiTaskSuggestionStatus`: `GENERATED`, `SELECTED`, `EXPIRED`, `CANCELLED`.

Models chính đã có:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `Policy`
- `Department`
- `Position`
- `Employee`
- `EmployeeManager`
- `Team`
- `TeamMember`
- `AttendanceRecord`
- `SystemSetting`
- `LeaveType`
- `LeaveRequest`
- `AuditLog`
- `Project`
- `Skill`
- `PositionSkill`
- `EmployeeSkill`
- `Task`
- `TaskRequiredSkill`
- `TaskAssignment`
- `AiTaskSuggestion`
- `AiTaskSuggestionItem`

### 5.4 Migrations đã có

Các migration hiện có:

```txt
20260606000000_init
20260609000000_phase2_task_ai_assignment
20260615070000_attendance_settings_location
20260616010000_vietnamese_leave_type_names
20260616020000_position_skill_mapping
20260616030000_employee_career_level
20260616040000_add_fresher_career_level
20260616050000_position_department
20260616060000_team_structure
20260617010000_department_manager
20260617020000_employee_avatar
20260617030000_employee_avatar_text
20260618020000_team_member_history
20260618021000_admin_all_permissions
```

Ý nghĩa theo tên migration:

- Init tạo nền CoreHR.
- Phase 2 thêm project/task/skill/AI assignment.
- Attendance settings location thêm ca chấm công, trạng thái chấm công, vị trí, system settings.
- Vietnamese leave type names đổi tên loại nghỉ sang tiếng Việt.
- Position skill mapping gắn kỹ năng theo chức danh.
- Career level và Fresher bổ sung level nghề nghiệp.
- Position department gắn chức danh với phòng ban.
- Team structure thêm team và thành viên team.
- Department manager thêm trưởng phòng.
- Employee avatar thêm avatar.
- Team member history theo dõi lịch sử tham gia team.
- Admin all permissions đảm bảo admin có đủ quyền.

### 5.5 Seed data đã làm

`prisma/seed.ts` đã làm rất nhiều dữ liệu demo:

- Seed 3 role: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Seed danh sách permissions Phase 1 và Phase 2.
- Gán permission theo role.
- Seed leave types:
  - `ANNUAL_LEAVE`
  - `SICK_LEAVE`
  - `UNPAID_LEAVE`
  - `MATERNITY_LEAVE`
  - `MARRIAGE_LEAVE`
  - `BEREAVEMENT_LEAVE`
- Seed danh mục kỹ năng lớn, gồm frontend, backend, mobile, cloud, devops, security, data, management.
- Seed mapping skill theo position.
- Seed phòng ban mock:
  - Engineering.
  - IT.
  - Operations.
  - HR.
- Seed nhiều chức danh IT/HR:
  - IT Manager.
  - Engineering Manager.
  - Tech Lead.
  - Software Architect.
  - Product Owner.
  - Scrum Master.
  - Business Analyst.
  - UI/UX Designer.
  - Frontend Developer.
  - Backend Developer.
  - Fullstack Developer.
  - Mobile Developer.
  - QA Engineer.
  - DevOps Engineer.
  - Data Engineer.
  - DBA.
  - Security Engineer.
  - System Admin.
  - Network Engineer.
  - IT Support.
  - HR Specialist.
- Seed user/employee mock:
  - `manager01`
  - `employee01`
  - `employee02`
  - `employee03`
  - `employee04`
- Seed quan hệ manager trực tiếp cho một số employee.
- Seed employee skills.
- Seed project mock:
  - `OMNI-CORE`
  - `OMNI-OPS`
- Seed task mock.
- Seed required skills cho task.
- Seed task assignments.
- Seed leave request approved để test availability score.
- Seed attendance records ngày 2026-06-09.
- Seed AI task suggestion mock cho UI review.
- Ghi audit log cho seed admin và seed mock data.

### 5.6 Auth đã làm

Backend Auth đã có:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`

Luồng bảo mật đã triển khai:

- Login bằng username hoặc email.
- Check user active và chưa bị soft delete.
- So sánh password bằng bcrypt.
- Trả access token và refresh token.
- Refresh token được hash trong database.
- Refresh token có version.
- Refresh token rotation khi refresh.
- Phát hiện reuse token: nếu token không khớp hash/version thì xóa hash, tăng version, ghi audit `REFRESH_TOKEN_REUSE_DETECTED`.
- Logout xóa refresh token hash và tăng version.
- `me` hydrate lại user, role, permission và employee id.
- Change password cập nhật hash, clear refresh token, tăng version, set `mustChangePassword = false`.

### 5.7 RBAC và ABAC đã làm

RBAC:

- Có bảng roles, permissions, user_roles, role_permissions.
- Role chính thức: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Global `PermissionsGuard` kiểm tra permission.
- Decorator `@Permissions(...)` đã dùng rộng rãi ở controller.

ABAC:

`AccessControlService` đã xử lý phạm vi dữ liệu:

- Admin pass toàn bộ.
- Manager chỉ đọc employee thuộc team/subordinate scope.
- Employee đọc dữ liệu của chính mình.
- Manager không được approve/reject đơn nghỉ của chính mình.
- Manager scope lấy từ:
  - `employee_managers`.
  - team lead.
  - membership có role `LEAD`.
  - department manager theo một số rule.
- Task/project scope:
  - Manager đọc project nếu là manager project, lead/member team liên quan, hoặc có task liên quan tới subordinate.
  - Employee đọc task của mình.
  - Manager chỉ assign task cho employee trong phạm vi.
  - AI suggestion chỉ cho Admin/Manager.

### 5.8 Users đã làm

API chính:

- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `POST /users/:id/roles`
- `DELETE /users/:id/roles/:roleId`
- `POST /users/:id/reset-password`

Chức năng:

- List user có phân trang.
- Tạo user.
- Sửa user.
- Soft delete user.
- Gán role.
- Gỡ role.
- Reset password.
- Có logic đảm bảo employee profile khi role yêu cầu.
- Có logic kiểm tra email/employee code không trùng.
- Có xử lý vị trí/chức danh manager cần role manager.

### 5.9 Employees đã làm

API chính:

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

Chức năng:

- Admin xem toàn bộ employee.
- Manager xem team.
- Employee xem hồ sơ cá nhân.
- Tạo employee kèm user account.
- Sửa employee.
- Employee tự cập nhật một số thông tin cá nhân.
- Soft delete employee.
- Reset password employee.
- Lock/unlock user của employee.
- Kiểm tra department và position hợp lệ.
- Gắn role manager theo position nếu position có tính chất manager.
- Trả default password một lần cho admin khi tạo/reset.

### 5.10 Departments đã làm

API chính:

- `GET /departments`
- `GET /departments/tree`
- `GET /departments/:id`
- `POST /departments`
- `PATCH /departments/:id`
- `DELETE /departments/:id`

Chức năng:

- CRUD phòng ban.
- Cây phòng ban cha/con.
- Soft delete.
- Gán manager cho department.
- Kiểm tra vòng lặp parent.
- Kiểm tra manager thuộc department.

### 5.11 Positions đã làm

API chính:

- `GET /positions`
- `GET /positions/:id`
- `POST /positions`
- `PATCH /positions/:id`
- `DELETE /positions/:id`

Chức năng:

- CRUD chức danh.
- Gắn position với department.
- Soft delete.
- Có skill mapping qua `PositionSkill`.
- Có career level ở employee.

### 5.12 Teams đã làm

API chính:

- `GET /teams`
- `GET /teams/:id`
- `POST /teams`
- `PATCH /teams/:id`
- `DELETE /teams/:id`
- `POST /teams/:id/members`
- `PATCH /teams/:id/members/:memberId`
- `DELETE /teams/:id/members/:memberId`

Chức năng:

- Tạo/sửa/xóa mềm team.
- Team thuộc department.
- Team có lead.
- Thành viên team có role `LEAD` hoặc `MEMBER`.
- Có joined/left history.
- Có rule đồng bộ lead membership.
- Có rule hạ lead cũ khi set lead mới.
- Có kiểm tra employee cùng department.

### 5.13 Employee Managers đã làm

API chính:

- `GET /employee-managers`
- `GET /employee-managers/employee/:employeeId`
- `GET /employee-managers/manager/:managerId/subordinates`
- `POST /employee-managers`
- `PATCH /employee-managers/:id/end`

Chức năng:

- Xem quan hệ manager.
- Gán direct/project manager.
- Kết thúc quan hệ quản lý.
- Không cho manager là chính employee.
- Có kiểm tra active relation trùng.
- Có kiểm tra mỗi employee chỉ có một direct manager active.
- Có kiểm tra vòng lặp quản lý.

### 5.14 Attendance đã làm

Đây là phần quan trọng trước khi tiếp tục.

API chính:

- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET /attendance`
- `GET /attendance/self`
- `GET /attendance/team`
- `GET /attendance/employee/:employeeId`
- `POST /attendance/admin`
- `PATCH /attendance/:id`

Database `AttendanceRecord` đã lưu:

- Employee.
- Work date.
- Record type: check-in, check-out, adjustment.
- Recorded at.
- Shift: morning/afternoon.
- Attendance status: on time, late, early out, manual adjustment.
- Latitude.
- Longitude.
- Address.
- Distance meters.
- Source: `MOBILE`, `ADMIN`, `SEED`.
- Note.
- Is adjustment.
- Created/updated by user.
- Created/updated timestamps.

Rule check-in:

- User phải có employee profile.
- Lấy settings hiện tại.
- Tính work date theo timezone offset.
- Xác định ca check-in theo giờ hiện tại.
- Cho phép check-in sớm theo `attendanceEarlyCheckInMinutes`.
- Nếu ngoài giờ ca thì trả lỗi `ATTENDANCE_INVALID_ACTION`.
- Không cho check-in liên tiếp khi chưa check-out.
- Không cho check-in trùng ca.
- Tính `ON_TIME` hoặc `LATE`.
- Resolve vị trí nếu có.
- Nếu settings yêu cầu vị trí mà không có lat/long thì lỗi.
- Nếu settings yêu cầu vị trí mà chưa cấu hình tọa độ công ty thì lỗi.
- Nếu ngoài bán kính công ty thì lỗi.
- Ghi audit `CHECK_IN`.

Rule check-out:

- Phải có check-in gần nhất trong cùng work date.
- Không tự tạo check-in giả.
- Nếu chưa check-in thì lỗi `ATTENDANCE_INVALID_ACTION`.
- Lấy ca từ check-in gần nhất hoặc theo giờ hiện tại.
- Nếu check-out trước giờ kết thúc ca thì `EARLY_OUT`, ngược lại `ON_TIME`.
- Resolve vị trí tương tự check-in.
- Ghi audit `CHECK_OUT`.

Admin adjustment:

- `POST /attendance/admin`: admin tạo bản ghi điều chỉnh.
- `PATCH /attendance/:id`: admin cập nhật bản ghi.
- Record admin có `source = ADMIN`, `isAdjustment = true`.
- Status là `MANUAL_ADJUSTMENT`.
- Bắt buộc note khi tạo.
- Ghi audit:
  - `ATTENDANCE_ADMIN_CREATE`
  - `ATTENDANCE_ADMIN_UPDATE`

Query:

- Admin xem tất cả.
- Employee xem self.
- Manager xem team theo ABAC.
- Có lọc employee, department, record type, from/to date.
- Có phân trang.

System settings liên quan attendance:

- `companyName`
- `companyAddress`
- `companyLatitude`
- `companyLongitude`
- `attendanceRadiusMeters`
- `requireAttendanceLocation`
- `timezoneOffsetMinutes`
- `attendanceEarlyCheckInMinutes`
- `morningShiftStart`
- `morningShiftEnd`
- `afternoonShiftStart`
- `afternoonShiftEnd`

Mặc định hiện tại:

- `requireAttendanceLocation = true`
- `attendanceRadiusMeters = 100`
- `timezoneOffsetMinutes = 420` tương ứng UTC+7
- Ca sáng: 08:00 - 12:00
- Ca chiều: 13:00 - 17:00
- Check-in sớm tối đa 60 phút
- Tọa độ công ty mặc định là `null`

Điểm cần chú ý: vì mặc định bắt buộc vị trí nhưng tọa độ công ty đang `null`, luồng check-in/check-out thật sẽ cần cấu hình tọa độ công ty trong System Settings trước.

### 5.15 Leave Types đã làm

API chính:

- `GET /leave-types`
- `GET /leave-types/:id`
- `POST /leave-types`
- `PATCH /leave-types/:id`
- `DELETE /leave-types/:id`

Chức năng:

- CRUD loại nghỉ.
- Có annual allowance.
- Có bật/tắt `isActive`.
- Seed tên tiếng Việt.

### 5.16 Leave Requests đã làm

API chính:

- `POST /leave-requests`
- `GET /leave-requests`
- `GET /leave-requests/self`
- `GET /leave-requests/team`
- `GET /leave-requests/:id`
- `POST /leave-requests/:id/approve`
- `POST /leave-requests/:id/reject`
- `POST /leave-requests/:id/cancel`

Chức năng:

- Employee tạo đơn nghỉ.
- Backend tính tổng ngày nghỉ.
- Loại cuối tuần theo rule weekdays.
- Không cho tạo đơn nếu ngày không hợp lệ.
- Không cho overlap với đơn pending/approved.
- Admin xem tất cả.
- Manager xem team.
- Employee xem self.
- Manager/Admin approve/reject.
- Employee cancel đơn pending của mình.
- Không cho tự approve đơn của chính mình.
- Ghi audit các thao tác chính.

### 5.17 Audit Logs đã làm

API chính:

- `GET /audit-logs`

Chức năng:

- Ghi action quan trọng.
- Lưu user, entity type, entity id, old value, new value, IP, user agent, created at.
- Có lọc qua DTO.
- Dashboard admin hiển thị recent audit logs.

### 5.18 Dashboard và System Settings đã làm

Admin dashboard trả:

- Tổng nhân viên.
- Tổng phòng ban.
- Tổng chức danh.
- User active.
- Đơn nghỉ pending.
- Bản ghi chấm công hôm nay.
- Audit log gần đây.

Manager dashboard trả:

- Số nhân viên team.
- Đơn nghỉ pending của team.
- Chấm công hôm nay của team.
- Đơn nghỉ mới nhất của team.
- Subordinates mới nhất.

System settings:

- `GET /system-settings`
- `PATCH /system-settings`
- Settings lưu JSON trong bảng `system_settings`.
- Có normalize dữ liệu settings, validate time, coordinate, radius, timezone.

### 5.19 Projects đã làm

API chính:

- `GET /projects`
- `GET /projects/:id`
- `POST /projects`
- `PATCH /projects/:id`
- `DELETE /projects/:id`

Chức năng:

- CRUD project.
- Project có department, team, manager.
- Project có status.
- Có start/end date.
- Soft delete.
- ABAC cho manager scope.
- Kiểm tra reference department/manager.
- Kiểm tra manager được dùng trong project scope.

### 5.20 Skills đã làm

API chính:

- `GET /skills`
- `GET /skills/:id`
- `POST /skills`
- `PATCH /skills/:id`
- `DELETE /skills/:id`

Chức năng:

- CRUD skill.
- Skill có code, name, category, description, isActive.
- Có liên kết với positions.
- Có liên kết với employee skills.
- Có liên kết với task required skills.

### 5.21 Employee Skills đã làm

API chính:

- `GET /employees/:employeeId/skills`
- `POST /employees/:employeeId/skills`
- `PATCH /employee-skills/:id`
- `DELETE /employee-skills/:id`

Chức năng:

- Gắn skill cho employee.
- Lưu years experience.
- Lưu proficiency.
- Lưu last used.
- Lưu note.
- Unique employee + skill.
- ABAC: manager chỉ thao tác trong team, employee chỉ đọc self nếu có quyền.

### 5.22 Tasks đã làm

API chính:

- `GET /tasks`
- `GET /tasks/team`
- `GET /tasks/me`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/:id/assign`
- `PATCH /tasks/:id/status`

Chức năng:

- Tạo task.
- Sửa task.
- Xóa mềm task.
- Gắn project, department, team.
- Priority và status.
- Assignee.
- Created by và assigned by.
- Start/due date.
- Estimated/actual hours.
- Required skills.
- Giao task thủ công.
- Cập nhật status.
- Ghi task assignment khi assign.
- ABAC:
  - Admin toàn quyền.
  - Manager trong phạm vi team/subordinate.
  - Employee xem/update status task của mình.

### 5.23 Task Assignments đã làm

API chính:

- `GET /task-assignments`

Chức năng:

- Xem lịch sử giao task.
- Lưu task, assignee, assigned by, assignment type, note, assigned at.
- Assignment type gồm manual, AI suggested, reassigned.

### 5.24 Task Workload đã làm

API chính:

- `GET /task-workload`

Chức năng:

- Tính workload summary theo employee.
- Active task count.
- Total estimated hours.
- Overdue task count.
- Capacity hours per week.
- Available hours.
- Workload score.
- Scope theo admin/manager/employee.

### 5.25 AI Task Suggestions đã làm

API chính:

- `POST /tasks/:taskId/ai-suggestions`
- `GET /tasks/:taskId/ai-suggestions`
- `GET /ai-task-suggestions`
- `GET /ai-task-suggestions/:id`
- `POST /ai-task-suggestions/:id/select`

Chức năng:

- Tạo gợi ý người nhận task.
- Rule-based, chưa phải ML thật.
- Có algorithm version `rule-based-v1`.
- Dùng skill score.
- Dùng workload score.
- Có availability score dựa trên leave request nếu include availability.
- Lưu input snapshot.
- Lưu danh sách item gồm employee, rank, score, skill/workload/availability/performance score, reason.
- Chọn một suggestion item để assign task.
- Khi chọn:
  - Update assignee task.
  - Set assigned by.
  - Set suggestion status selected.
  - Mark selected item.
  - Tạo task assignment loại `AI_SUGGESTED`.
  - Ghi audit.

### 5.26 Docker đã làm

Backend có:

- `Dockerfile`
- `docker-compose.yml`

Compose services:

- `api`
- `postgres`
- `redis`

Ports:

- API: 3000.
- PostgreSQL: 5432.
- Redis: 6379.

Database URL trong compose dùng host `postgres`. Local dev dùng `.env` với `localhost`.

## 6. Web đã làm

### 6.1 Cấu trúc app web

Web có các route chính:

- `/login`
- `/forbidden`
- `/employee-web-notice`
- `/app/*`
- `/admin/*`

Route guard:

- `AuthHydrator`: hydrate auth và preferences.
- `RequireAuth`: yêu cầu login.
- `RequireRole`: kiểm tra role.
- `RootRedirect`: redirect theo role.

Rule hiện tại:

- Admin vào `/admin/dashboard`.
- Manager vào `/app/dashboard`.
- Employee-only vào `/employee-web-notice`.
- User không có quyền vào `/forbidden`.

### 6.2 Auth web đã làm

Web có:

- Login page.
- Zustand auth store.
- Lưu access token, refresh token, user.
- Axios interceptor gắn Bearer token.
- Axios response interceptor tự refresh khi 401.
- Nếu refresh fail thì logout local.
- Logout gọi API rồi clear local session.

### 6.3 Layout web đã làm

`ShellLayout` dùng Mantine AppShell:

- Header.
- Sidebar nav.
- Avatar/user menu.
- Role chip.
- Logout.
- Modal settings.
- Đổi ngôn ngữ English/Vietnamese.
- Đổi light/dark theme.
- Brand `OmniHR`.

### 6.4 i18n web đã làm

Web có `i18n.ts`:

- Message key cho English và Vietnamese.
- Hàm `translateText`.
- Hàm `translateEnum`.
- `useTranslation`.
- Dịch nhiều enum nghiệp vụ:
  - Role.
  - Attendance status.
  - Leave status.
  - Task status.
  - Task priority.
  - Project status.
  - Skill proficiency.
  - Assignment type.
  - AI suggestion status.

### 6.5 API client web đã làm

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

`src/api/types.ts` đã có type cho:

- Auth user/login.
- Pagination.
- Department/Position/Employee/User.
- Leave type/request.
- Attendance.
- Role/Permission.
- Employee manager.
- Team.
- Project.
- Skill.
- Employee skill.
- Task.
- Task required skill.
- Task assignment.
- Workload.
- AI suggestion.
- Audit log.
- Dashboard.

### 6.6 Admin web hiện có route

Trong `App.tsx`, admin hiện route:

- `/admin/dashboard`
- `/admin/employees` redirect sang `/admin/users`
- `/admin/departments`
- `/admin/positions`
- `/admin/leave-types`
- `/admin/skills`
- `/admin/users`
- `/admin/roles-permissions`
- `/admin/policies`
- `/admin/audit-logs`
- `/admin/system-settings`

Admin nav hiện có:

- Dashboard.
- Users.
- Departments.
- Positions.
- Leave Types.
- Skills.
- Roles & Permissions.
- Audit Logs.
- Policies.
- System Settings.

Lưu ý quan trọng:

- Feature files cho attendance, leave requests, managers, projects, tasks, employee skills, AI task suggestions đã tồn tại.
- API client cũng đã có endpoint cho các phần đó.
- Nhưng admin route/menu hiện chưa expose đầy đủ các trang Phase 2 như projects/tasks/employee-skills/AI suggestions/attendance/leave requests/managers.
- `/admin/employees` hiện redirect sang `/admin/users`, nghĩa là admin quản lý nhân viên chủ yếu qua `UsersPage`, không phải `EmployeesPage` riêng.

### 6.7 Manager app web hiện có route

Trong `/app`, manager hiện có:

- Dashboard.
- Teams.
- My Team.
- Employee Skills.
- Team Attendance.
- Team Leave Requests.
- Projects.
- Team Tasks.
- Assign Task.
- AI Task Suggestions.
- My Profile.

Manager nav hiện có:

- Dashboard.
- My Team.
- Teams.
- Employee Skills.
- Team Attendance.
- Team Leave Requests.
- Projects.
- Team Tasks.
- Assign Task.
- AI Task Suggestions.
- My Profile.

### 6.8 Các màn web đã làm theo feature

Đã có màn:

- Login.
- Status pages: forbidden, mobile notice.
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

### 6.9 Web AttendancePage đã làm

`AttendancePage` web hiện có:

- Scope `all` hoặc `team`.
- List attendance records.
- Filter theo employee.
- Gọi `attendanceApi.list` cho admin/all.
- Gọi `attendanceApi.team` cho manager/team.
- Check-in/check-out từ browser nếu user có employee profile và permission.
- Lấy vị trí browser qua `navigator.geolocation`.
- Admin tạo attendance adjustment.
- Hiển thị:
  - Employee.
  - Work date.
  - Record type.
  - Shift.
  - Attendance status.
  - Recorded at.
  - Location/distance.
  - Source.
  - Note.
- Badge màu cho status.

Hạn chế hiện tại:

- Admin attendance page có file nhưng chưa được route/menu admin expose trong `App.tsx`/`nav.ts`.
- Admin update attendance API có trong endpoint, nhưng UI hiện mới thấy form tạo adjustment, chưa thấy flow edit record rõ ràng.

### 6.10 System Settings web đã làm

`SystemSettingsPage` đã có form cấu hình:

- Company name.
- Company address.
- Company latitude.
- Company longitude.
- Attendance radius.
- Early check-in window.
- Morning shift start/end.
- Afternoon shift start/end.
- Timezone offset.
- Require attendance location.

Đây là màn rất quan trọng để chấm công bằng GPS hoạt động.

## 7. Mobile app đã làm

### 7.1 App shell và theme

`OmniHrApp` đã có:

- MaterialApp.
- Theme Material 3.
- Brand color blue.
- Green secondary.
- Amber accent.
- Background nhạt.
- Card/input/button radius 8.
- Navigation bar theme.
- Boot screen.
- Login screen nếu chưa đăng nhập.
- Home shell nếu đã đăng nhập.

`DESIGN_STANDARD.md` đã ghi chuẩn thiết kế mobile:

- UI operational HR, calm, compact, work-focused.
- Palette dùng theo web.
- Radius 8px.
- Tránh decorative quá mức.
- Form compact.
- Dùng panel/list cho enterprise UI.

### 7.2 Session mobile đã làm

`AppSession` đã có:

- Bootstrap từ SharedPreferences.
- Lưu API base URL.
- Lưu access token.
- Lưu refresh token.
- Lưu user.
- Gọi `/auth/me`.
- Load `/employees/me`.
- Login bằng username/email/password/API URL.
- Refresh token khi API 401.
- Logout API và local.
- Clear local session.

### 7.3 ApiService mobile đã làm

`ApiService` đã có:

- Build URI từ base URL.
- GET/POST/PATCH/DELETE.
- JSON encode body.
- Timeout 20s.
- Header Bearer token.
- Unwrap response `data`.
- Parse error message/errorCode.
- Auto refresh access token khi 401.
- Helper `getList<T>` cho list hoặc paginated `items`.

### 7.4 Models mobile đã làm

`omni_models.dart` đã có model:

- LoginResponse.
- AuthUser.
- Department.
- Position.
- Project.
- Employee.
- LeaveType.
- LeaveRequest.
- AttendanceRecord.
- Skill.
- EmployeeSkill.
- TaskRequiredSkill.
- TaskItem.

### 7.5 Login mobile đã làm

Login screen đã có:

- Nhập username/email.
- Nhập password.
- Nhập API base URL.
- Gọi session login.
- Xử lý loading/error.
- Có assets ảnh login office.
- Có brand UI.

### 7.6 HomeShell mobile hiện tại

Bottom navigation hiện chỉ có 3 tab:

- Home.
- Task.
- Profile.

Pages hiện được mount:

```dart
DashboardScreen(session: widget.session)
TasksScreen(session: widget.session)
ProfileScreen(session: widget.session)
```

Lưu ý:

- `AttendanceScreen` có file nhưng chưa được đưa vào `_pages` và `NavigationDestination`.
- `LeaveScreen` có file nhưng chưa được đưa vào `_pages` và `NavigationDestination`.
- Tab `Task` hiện thực chất đang là màn tạo đơn xin nghỉ thủ công, chưa phải task list đúng nghĩa.

### 7.7 Dashboard mobile đã làm

`DashboardScreen` hiện làm khá nhiều phần chấm công:

- Load employee profile.
- Nếu user có permission `ATTENDANCE_READ_SELF`, gọi `/attendance/self?limit=10`.
- Lọc attendance của hôm nay.
- Xác định latest record.
- Nếu latest là `CHECK_IN` thì action kế tiếp là check-out.
- Nếu chưa có hoặc latest là `CHECK_OUT` thì action kế tiếp là check-in.
- Hiển thị greeting panel.
- Hiển thị attendance panel.
- Nút chấm công dạng tròn lớn.
- Confirm dialog trước khi check-in/check-out.
- Check permission:
  - `ATTENDANCE_CHECK_IN`
  - `ATTENDANCE_CHECK_OUT`
- Lấy vị trí bằng `currentAttendanceLocationPayload`.
- Gọi:
  - `/attendance/check-in`
  - `/attendance/check-out`
- Refresh sau khi ghi nhận.

### 7.8 GPS mobile đã làm

`attendance_location.dart` đã có:

- Kiểm tra location service.
- Check permission.
- Request permission nếu bị denied.
- Xử lý denied.
- Xử lý deniedForever.
- Lấy current position với accuracy high.
- Timeout 10 giây.
- Trả payload:

```json
{
  "latitude": 0,
  "longitude": 0
}
```

Android manifest đã có:

- `INTERNET`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `usesCleartextTraffic="true"`

### 7.9 AttendanceScreen mobile đã làm nhưng chưa wire

`AttendanceScreen` hiện có:

- Load `/attendance/self?limit=50`.
- Pull refresh.
- Check-in/check-out với GPS.
- Hiển thị số record hôm nay.
- Hiển thị history.
- Empty/loading/error states.

Nhưng màn này chưa được đưa vào bottom navigation. Nếu muốn phần chấm công là một tab riêng, cần wire vào `HomeShell`.

### 7.10 Leave mobile đã làm nhưng chưa wire đầy đủ

`LeaveScreen` hiện có:

- Load `/leave-types`.
- Load `/leave-requests/self`.
- Tạo đơn nghỉ bằng bottom sheet.
- Chọn leave type.
- Chọn start/end date.
- Nhập reason.
- Gọi `/leave-requests`.
- Cancel đơn pending.
- Hiển thị pending/approved/total.
- Hiển thị list requests.

Nhưng màn này chưa nằm trong bottom navigation.

### 7.11 TasksScreen mobile hiện tại

Tên là `TasksScreen` nhưng hiện đang làm chức năng tạo đơn xin nghỉ thủ công:

- Load `/leave-types`.
- Kiểm tra permission `LEAVE_CREATE`.
- Bottom sheet tạo đơn xin nghỉ.
- Gọi `/leave-requests`.
- UI ghi rõ tạm thời tab này chỉ dùng để tạo đơn xin nghỉ thủ công.

Điểm cần chỉnh sau:

- Nếu app cần module task thật, `TasksScreen` nên gọi `/tasks/me`.
- Nếu app cần Leave tab riêng, chức năng nghỉ phép nên chuyển về `LeaveScreen`.

### 7.12 Profile mobile đã làm

`ProfileScreen` đã có:

- Load employee profile.
- Hiển thị avatar chữ cái đầu.
- Hiển thị employee code, department, position.
- Bottom sheet hồ sơ:
  - Email công ty.
  - Phone.
  - Department.
  - Position.
  - Hire date.
- Bottom sheet chính sách:
  - Nội quy.
  - Phúc lợi.
  - Quy định nghỉ phép.
  - Hiện đang là placeholder chờ dữ liệu chính sách.
- Bottom sheet cài đặt:
  - Đổi mật khẩu.
  - API server.
  - Đăng xuất.
- Dialog đổi mật khẩu gọi `/auth/change-password`.

### 7.13 HRGenie mobile placeholder

HomeShell có floating action button HRGenie:

- Custom painter vẽ mascot.
- Mở bottom sheet.
- Nội dung hiện là trợ lý nhân sự sẽ được kết nối ở bước sau.

Chưa có chatbot thật.

## 8. Kiểm thử và chất lượng hiện có

### 8.1 Backend tests đã có file

Backend có test:

- `auth.service.spec.ts`
- `common/utils.spec.ts`
- `sanitize-input.pipe.spec.ts`
- `response.interceptor.spec.ts`

Các test bao phủ:

- Refresh token trả session shape.
- Date-only UTC.
- Format password theo `ddMMyyyy`.
- Tính ngày nghỉ bỏ cuối tuần.
- Pagination bounds.
- Omit sensitive user fields.
- Sanitize input.
- Response interceptor wrap envelope.

### 8.2 Mobile test đã có file

Flutter có `test/widget_test.dart`:

- Kiểm tra khi chưa có session thì hiện login screen.

### 8.3 Web tests

Trong `package.json` web hiện chưa có script test. Web có build/lint/dev/preview.

### 8.4 Lưu ý

Trong lần xuất báo cáo này chưa chạy lại test/build. Nội dung báo cáo dựa trên việc đọc source hiện tại.

## 9. Những phần đã làm nhưng cần chú ý chưa hoàn toàn khép kín

### 9.1 Admin web chưa expose đủ route/menu

Các file và API cho nhiều module đã có, nhưng admin menu/route hiện chưa expose đầy đủ:

- Attendance.
- Leave Requests.
- Managers.
- Projects.
- Tasks.
- Employee Skills.
- AI Task Suggestions.

Nếu cần admin dùng các màn này, cần thêm route trong `App.tsx` và nav item trong `nav.ts`.

### 9.2 Policies đang là tài liệu tĩnh

Backend schema có model `Policy`, nhưng backend module policy chưa triển khai controller/service đầy đủ. Web `PoliciesPage` hiện là tài liệu chính sách vận hành, không phải CRUD dynamic policy.

### 9.3 Mobile navigation chưa khớp README cũ

README mobile ghi bottom navigation:

- Home.
- Time.
- Leave.
- Tasks.
- Me.

Nhưng code hiện tại chỉ có:

- Home.
- Task.
- Profile.

Cần cập nhật README hoặc cập nhật HomeShell để khớp thiết kế mong muốn.

### 9.4 Task mobile chưa phải task thật

Backend/web đã có task Phase 2 khá đầy đủ, nhưng mobile `TasksScreen` hiện là tạo đơn nghỉ. Nếu cần nhân viên xem task cá nhân trên app, cần làm màn gọi `/tasks/me`.

### 9.5 Chấm công cần cấu hình tọa độ công ty

Backend mặc định bắt buộc location. Nếu chưa cấu hình:

- `companyLatitude = null`
- `companyLongitude = null`

thì check-in/check-out sẽ lỗi `Company attendance location is not configured.`

Trước khi demo chấm công GPS, admin cần vào System Settings lưu tọa độ công ty và bán kính hợp lệ, hoặc tạm tắt `requireAttendanceLocation`.

### 9.6 Dist và generated files có thay đổi

Git status hiện có thay đổi ở:

- `OmniHR_BE/dist`
- `OmniHR_BE/node_modules/.prisma`

Đây thường là output build/generate. Khi chuẩn bị commit, nên cân nhắc có commit các file này không.

## 10. Trạng thái riêng của phần chấm công trước khi làm tiếp

### 10.1 Backend chấm công hiện có

Đã có:

- API check-in.
- API check-out.
- API self history.
- API team history.
- API all history.
- API employee history.
- API admin create adjustment.
- API admin update adjustment.
- Lưu GPS.
- Tính khoảng cách tới công ty.
- Bắt buộc trong bán kính nếu bật setting.
- Chia ca sáng/chiều.
- Tính late/early out/on time/manual adjustment.
- Audit log.
- Permission:
  - `ATTENDANCE_CHECK_IN`
  - `ATTENDANCE_CHECK_OUT`
  - `ATTENDANCE_READ_ALL`
  - `ATTENDANCE_READ_TEAM`
  - `ATTENDANCE_READ_SELF`
  - `ATTENDANCE_ADJUST`

### 10.2 Web chấm công hiện có

Đã có:

- Attendance page.
- List bản ghi.
- Filter employee.
- Browser geolocation check-in/check-out.
- Admin adjustment create.
- Hiển thị shift/status/location/source/note.

Cần làm tiếp:

- Add route/menu admin nếu admin cần dùng.
- Có thể thêm edit adjustment UI.
- Có thể thêm filter ngày, loại record, phòng ban nếu UI cần đầy đủ hơn.

### 10.3 Mobile chấm công hiện có

Đã có:

- Dashboard check-in/check-out.
- Confirm dialog.
- Permission check.
- GPS qua geolocator.
- Android permissions.
- History gần nhất trên dashboard.
- Standalone AttendanceScreen có history 50 records.

Cần làm tiếp:

- Quyết định navigation:
  - Giữ chấm công ở Home, hoặc
  - Thêm tab Time/Chấm công riêng.
- Nếu thêm tab riêng, wire `AttendanceScreen` vào `HomeShell`.
- Việt hóa đầy đủ text trong `AttendanceScreen` nếu dùng.
- Hiển thị rõ lỗi GPS và lỗi ngoài bán kính bằng tiếng Việt dễ hiểu.
- Thêm trạng thái "đã vào ca", "đã ra ca", "ca tiếp theo".
- Test trên Android emulator và máy thật.
- Test case chưa cấu hình tọa độ công ty.
- Test case denied location permission.
- Test case check-in ngoài giờ ca.
- Test case check-in trùng ca.
- Test case check-out khi chưa check-in.

## 11. Checklist đề xuất trước khi bắt tay làm tiếp chấm công

1. Chốt UI mobile:
   - Có cần tab `Time` riêng không?
   - Có cần tab `Leave` riêng không?
   - `TasksScreen` có chuyển về task thật không?

2. Cấu hình backend:
   - Lưu tọa độ công ty trong System Settings.
   - Lưu bán kính cho demo, ví dụ 100m hoặc rộng hơn nếu test từ xa.
   - Kiểm tra `requireAttendanceLocation`.
   - Kiểm tra giờ ca theo timezone Việt Nam.

3. Wire route web nếu cần admin:
   - Thêm `/admin/attendance`.
   - Thêm menu Attendance.
   - Thêm `/admin/leave-requests`, `/admin/projects`, `/admin/tasks` nếu muốn đồng bộ phase 2.

4. Wire mobile:
   - Import `AttendanceScreen` trong `home_shell.dart`.
   - Thêm NavigationDestination Time.
   - Cân nhắc thêm `LeaveScreen`.
   - Đổi label `Task` hiện tại nếu nó vẫn là nghỉ phép.

5. Kiểm thử:
   - Backend `npm run test`.
   - Backend `npm run build`.
   - Web `npm run build`.
   - App `flutter analyze`.
   - App `flutter test`.
   - App chạy trên Android để xác nhận permission location.

6. Dọn trước commit:
   - Xem lại generated files trong `dist` và `.prisma`.
   - Không commit file log dev nếu không cần.
   - Không commit output build nếu project không chủ trương version output.

## 12. Kết luận

Tính đến snapshot này, OmniHR đã có nền fullstack khá rộng:

- Backend HR core Phase 1 đã có các module chính và bảo mật nền.
- Backend Phase 2 đã có project/task/skill/workload/AI suggestion.
- Web quản trị và manager workspace đã có nhiều màn CRUD/workflow.
- Mobile app đã có nền login/session/profile và nút chấm công GPS trên dashboard.

Phần cần làm tiếp cho chấm công không phải bắt đầu từ số 0. Nền backend đã sẵn, mobile đã có logic GPS và gọi API, web đã có AttendancePage. Việc tiếp theo nên tập trung vào hoàn thiện trải nghiệm người dùng, route/navigation, cấu hình tọa độ công ty, thông báo lỗi dễ hiểu và kiểm thử thực tế trên thiết bị.
